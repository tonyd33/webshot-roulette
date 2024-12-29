import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import * as randomstring from 'randomstring';
import R from 'ramda';
import { matchlike } from 'src/common/typescript';
import Result, { andThen } from 'src/common/monads/result';
import {
  catchPromise,
  ensureUnreachable,
  firstRest,
  guardPromise,
  pop,
  unwrapOrThrow,
  zodParseResult,
} from 'src/common/monads/addons';
import Maybe, { find } from 'src/common/monads/maybe';
import {
  Action,
  ActionEffect,
  ActionSchema,
  Bullet,
  GameDelta,
  Item,
  Lobby,
  LobbyId,
  PlayerId,
  PlayerState,
  PublicDelta,
  PublicGame,
  Waiting,
  Game,
} from './game.types';

const MAX_PLAYER_ITEMS = 8;
const MAX_ROUND_ITEM_REFILL = 4;

@Injectable()
export class GameService {
  private readonly redis: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getOrThrow();
  }

  async #syncLobbyEffect(lobbyId: LobbyId, lobby: Lobby) {
    if (lobby.state === 'active' && doneGame(lobby.game)) {
      await this.redis.del(lobbyId);
    } else {
      await this.redis.set(lobbyId, JSON.stringify(lobby));
    }
    return lobby;
  }

  async #syncDeltaEffect(lobbyId: LobbyId, delta: GameDelta) {
    this.#syncLobbyEffect(lobbyId, {
      id: lobbyId,
      state: 'active',
      game: delta.game,
    });
    return delta;
  }

  async getLobby(lobbyId: LobbyId): Promise<Result<Lobby, string>> {
    return this.redis
      .get(lobbyId)
      .then(JSON.parse)
      .then(Result.ok)
      .catch((x) => catchPromise(x, 'Could not find lobby')) as Promise<
      Result<Lobby, string>
    >;
  }

  async getGame(lobbyId: LobbyId): Promise<Result<Game, string>> {
    return this.getLobby(lobbyId)
      .then(
        andThen((lobby) =>
          lobby.state === 'active'
            ? Result.ok(lobby.game)
            : Result.err('No game'),
        ),
      )
      .catch(catchPromise);
  }

  async createLobby(initialPlayer: PlayerId): Promise<Result<Lobby, string>> {
    const lobbyId: LobbyId = randomstring.generate(4);
    const lobby: Lobby = {
      id: lobbyId,
      state: 'waiting',
      activePlayers: [initialPlayer],
    };
    await this.redis.set(lobbyId, JSON.stringify(lobby));

    return Result.ok(lobby);
  }

  async joinLobby(
    lobbyId: LobbyId,
    playerId: PlayerId,
  ): Promise<Result<Lobby, string>> {
    const lobby = await this.getLobby(lobbyId)
      .then(unwrapOrThrow)
      .then(
        (x: Waiting): Lobby => ({
          ...x,
          // TODO: Make sure this lobby exists
          id: lobbyId,
          state: 'waiting',
          activePlayers: R.uniq([...(x?.activePlayers ?? []), playerId]),
        }),
      )
      .then((lobby) => this.#syncLobbyEffect(lobbyId, lobby))
      .then((x) => Result.ok(x))
      .catch(catchPromise);

    return lobby;
  }

  async start(lobbyId: LobbyId): Promise<Result<PublicDelta, string>> {
    return this.getLobby(lobbyId)
      .then(unwrapOrThrow)
      .then(
        R.pipe(
          guardPromise((x) => x.state === 'waiting', 'Game already started'),
          (x) => x as Waiting,
        ),
      )
      .then(
        (lobby): Game => ({
          gun: [],
          maxPlayerItems: MAX_PLAYER_ITEMS,
          playerStates: lobby.activePlayers.map((pid, i) => ({
            id: pid,
            items: R.repeat(Item.nothing, MAX_PLAYER_ITEMS),
            health: 10,
            turn: i,
            statuses: [],
          })),
          turn: 0,
        }),
      )
      .then((game): GameDelta => ({ game, effects: [] }))
      .then(handleNextRound)
      .then(unwrapOrThrow)
      .then((delta) => this.#syncDeltaEffect(lobbyId, delta))
      .then(toPublicDelta)
      .then((x) => Result.ok(x))
      .catch(catchPromise);
  }

  async updateGame(
    lobbyId: string,
    player: PlayerId,
    actionUnsafe: any,
  ): Promise<Result<PublicDelta, string>> {
    const actionResult = zodParseResult(ActionSchema, actionUnsafe);
    if (actionResult.isErr) {
      return Result.err('Invalid action');
    }
    const action = actionResult.value;

    return this.getGame(lobbyId)
      .then(unwrapOrThrow)
      .then(
        guardPromise(
          (g: Game) =>
            g.playerStates.find((x) => x.turn === g.turn)?.id === player,
          'Not your turn',
        ),
      )
      .then((game: Game) =>
        handleAction(action, player, { game, effects: [] }).andThen(
          handlePostAction,
        ),
      )
      .then(unwrapOrThrow)
      .then((delta) => this.#syncDeltaEffect(lobbyId, delta))
      .then(toPublicDelta)
      .then((x) => Result.ok(x))
      .catch(catchPromise);
  }
}

function handleShoot(
  player: PlayerId,
  delta: GameDelta,
  action: Extract<Action, { type: 'shoot' }>,
): Result<GameDelta, string> {
  const [bullet, ...rest] = delta.game.gun;
  const effect: ActionEffect = {
    type: 'shoot',
    who: action.who,
    bullet: bullet,
    hurt: bullet === 'live' ? 1 : 0,
  };
  let newDelta: Result<GameDelta, string>;
  if (bullet === 'blank')
    newDelta = Result.ok({
      game: { ...delta.game, gun: rest },
      effects: [...delta.effects, effect],
    });
  else {
    newDelta = pop<PlayerState>(
      (x) => x.id === action.who,
      delta.game.playerStates,
    )
      .mapErr(() => 'Shooting nobody')
      .map(([player, rest]) => [
        { ...player, health: player.health - 1 },
        ...rest,
      ])
      .map((playerStates) => ({
        game: { ...delta.game, gun: rest, playerStates },
        effects: [...delta.effects, effect],
      }));
  }

  // If shooting self and blank, its still their turn
  if (action.who === player && bullet === 'blank') {
    return newDelta;
  } else {
    // otherwise, next turn
    return newDelta.andThen((x) => handlePass(player, x));
  }
}

function handlePass(
  player: PlayerId,
  delta: GameDelta,
): Result<GameDelta, string> {
  const newTurn = (delta.game.turn + 1) % delta.game.playerStates.length;
  return Result.ok({
    game: { ...delta.game, turn: newTurn },
    effects: [...delta.effects, { type: 'pass', turn: newTurn }],
  });
}
function handleUseItem(
  player: PlayerId,
  delta: GameDelta,
  action: Extract<Action, { type: 'useItem' }>,
): Result<GameDelta, string> {
  const playerState: Maybe<PlayerState> = find(
    (x) => x.id === player,
    delta.game.playerStates,
  );
  const item: Maybe<Item> = playerState
    .andThen((p) => Maybe.of(p.items[action.which]))
    .andThen((i) => (i === Item.nothing ? Maybe.nothing() : Maybe.just(i)));

  if (playerState.isNothing) return Result.err('No player');
  if (item.isNothing) return Result.err('No item');

  let newDelta: Result<GameDelta, string>;
  switch (item.value) {
    case Item.pop:
      newDelta = firstRest(delta.game.gun).map(
        ([first, rest]): GameDelta => ({
          game: { ...delta.game, gun: rest },
          effects: [...delta.effects, { type: 'pop', bullet: first }],
        }),
      );
      break;
    case Item.magnifyingGlass:
      newDelta = firstRest(delta.game.gun).map(
        ([first, rest]): GameDelta => ({
          game: { ...delta.game, gun: [first, ...rest] },
          effects: [...delta.effects, { type: 'inspect', bullet: first }],
        }),
      );
      break;
    case Item.apple:
      newDelta = Result.ok({
        game: {
          ...delta.game,
          playerStates: delta.game.playerStates.map((x) => {
            if (x.id !== player) return x;
            return {
              ...x,
              health: x.health + 1,
            };
          }),
        },
        effects: [...delta.effects, { type: 'nomnom', who: player, heal: 1 }],
      });
      break;
    case Item.nothing:
      newDelta = Result.ok(delta);
      break;
    default:
      return ensureUnreachable(item.value);
  }

  // remove the item
  return newDelta.map((x) => ({
    game: {
      ...x.game,
      playerStates: x.game.playerStates.map((p) => ({
        ...p,
        items: p.items.map((item, i) =>
          p.id === player && i === action.which ? Item.nothing : item,
        ),
      })),
    },
    effects: x.effects,
  }));
}

function handleAction(action: Action, player: PlayerId, delta: GameDelta) {
  return matchlike(action)('type')({
    shoot: (x) => handleShoot(player, delta, x),
    pass: () => handlePass(player, delta),
    useItem: (x) => handleUseItem(player, delta, x),
  });
}

function pickRandom<X>(arr: X[], n: number) {
  return R.range(0, n)
    .map(() => Math.floor(Math.random() * arr.length))
    .map((i) => arr[i]);
}

function handleNextRound(delta: GameDelta): Result<GameDelta, string> {
  // reload gun
  const lives = R.repeat('live', Math.floor(Math.random() * 4) + 1);
  const blanks = R.repeat('blank', Math.floor(Math.random() * 4) + 1);
  // shuffle gun
  const gun = R.flow(R.concat(lives, blanks) as Bullet[], [
    R.sortBy(() => Math.random() - 0.5),
  ]);

  // give items
  const players = delta.game.playerStates.map((player): PlayerState => {
    const needsNumItems = Math.min(
      player.items.filter((x) => x === Item.nothing).length,
      MAX_ROUND_ITEM_REFILL,
    );
    const randomItems = pickRandom(
      Object.values(Item).filter((x) => x !== Item.nothing),
      needsNumItems,
    );
    const newItems = player.items.reduce(
      (acc, val): [number, Item[]] => {
        const [randomIdx, currItems] = acc;
        if (val === Item.nothing && randomIdx < needsNumItems) {
          return [randomIdx + 1, [...currItems, randomItems[randomIdx]]];
        }
        return [randomIdx, [...currItems, val]];
      },
      [0, []] as [number, Item[]],
    )[1];

    return {
      ...player,
      items: newItems,
    };
  });
  return Result.ok({
    game: { ...delta.game, gun, playerStates: players },
    effects: [
      ...delta.effects,
      { type: 'reload', lives: lives.length, blanks: blanks.length },
    ],
  });
}

function doneGame(game: Game): boolean {
  return !!game.playerStates.find((p) => p.health <= 0);
}

function handlePostAction(delta: GameDelta): Result<GameDelta, string> {
  if (doneGame(delta.game)) {
    return Result.ok({ ...delta, effects: [...delta.effects, { type: 'gg' }] });
  }

  // if no more rounds, reload
  if (delta.game.gun.length === 0) {
    return handleNextRound(delta);
  }

  return Result.ok(delta);
}

function toPublicGame(game: Game): PublicGame {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { gun, ...rest } = game;
  return rest;
}

function toPublicDelta(delta: GameDelta): PublicDelta {
  return { game: toPublicGame(delta.game), effects: delta.effects };
}
