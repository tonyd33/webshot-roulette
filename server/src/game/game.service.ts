import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import * as randomstring from 'randomstring';
import R from 'ramda';
import Result, { andThen, map } from '@shared/true-myth/result';
import {
  catchPromise,
  guardPromise,
  unwrapOrThrow,
  zodParseResult,
} from '@shared/true-myth/addons';
import {
  ActionSchema,
  GameDeltas,
  Item,
  Lobby,
  LobbyId,
  PlayerId,
  PublicGameDelta,
  WaitingLobby,
  Game,
  PublicLobby,
  GameSettingsSchema,
} from '@shared/game/types';
import {
  MAX_LOBBY_TTL_SECONDS,
  MAX_PLAYER_ITEMS,
  MAX_PLAYERS,
} from './game.constants';
import {
  doneGame,
  forwardDeltaResults,
  getLatestGame,
  toPublicDeltas,
  toPublicLobby,
} from './game.utils';
import { handleAction } from './game.handlers';
import { forwardPreTransferControls } from './game.forwarders';
import { forwardNextRound } from './game.forwarders';

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
      await this.redis.expire(lobbyId, MAX_LOBBY_TTL_SECONDS);
    }
    return lobby;
  }

  async #syncDeltaEffect(lobbyId: LobbyId, deltas: GameDeltas) {
    const latestGame = getLatestGame(deltas);
    if (latestGame.isErr) return deltas;

    const lobby = await this.#getLobby(lobbyId).then(unwrapOrThrow);

    await this.#syncLobbyEffect(lobbyId, {
      ...lobby,
      state: 'active',
      game: latestGame.value,
    });
    return deltas;
  }

  async #getLobby(lobbyId: LobbyId): Promise<Result<Lobby, string>> {
    return this.redis
      .get(lobbyId)
      .then((x) => (x ? Result.ok(x) : Result.err('Could not find lobby')))
      .then(map(JSON.parse))
      .catch((x) => catchPromise(x, 'Could not find lobby')) as Promise<
      Result<Lobby, string>
    >;
  }

  async getPublicLobby(lobbyId: LobbyId): Promise<Result<PublicLobby, string>> {
    return this.#getLobby(lobbyId).then(map(toPublicLobby));
  }

  async changeSettings(
    lobbyId: LobbyId,
    playerId: PlayerId,
    settingsUnsafe: any,
  ): Promise<Result<PublicLobby, string>> {
    const settings = zodParseResult(
      GameSettingsSchema.partial(),
      settingsUnsafe,
    );

    if (settings.isErr) {
      return Result.err('Invalid settings');
    }

    return this.#getLobby(lobbyId)
      .then(unwrapOrThrow)
      .then(
        guardPromise(
          (l) => l.state === 'waiting',
          'Cannot change settings now',
        ),
      )
      .then((l) => l as WaitingLobby)
      .then(
        guardPromise(
          (l) => l.creator === playerId,
          'Only the creator can change settings',
        ),
      )
      .then((lobby) => ({
        ...lobby,
        settings: { ...lobby.settings, ...settings.value },
      }))
      .then((lobby) => this.#syncLobbyEffect(lobbyId, lobby))
      .then(toPublicLobby)
      .then((x) => Result.ok(x))
      .catch(catchPromise);
  }

  async getGame(lobbyId: LobbyId): Promise<Result<Game, string>> {
    return this.#getLobby(lobbyId)
      .then(
        andThen((lobby) =>
          lobby.state === 'active'
            ? Result.ok(lobby.game)
            : Result.err('No game'),
        ),
      )
      .catch(catchPromise);
  }

  async createLobby(playerId: PlayerId): Promise<Result<PublicLobby, string>> {
    const lobbyId: LobbyId =
      `${randomstring.generate(3)}-${randomstring.generate(3)}`.toLowerCase();
    const lobby: Lobby = {
      id: lobbyId,
      state: 'waiting',
      players: [],
      spectators: [],
      creator: playerId,
      settings: {
        stackHandsaws: false,
        handcuffCooldownTurns: 1,
        itemDistribution: Object.values(Item).filter((x) => x !== Item.nothing),
        players: 2,
      },
    };
    await this.#syncLobbyEffect(lobbyId, lobby);

    return Result.ok(toPublicLobby(lobby));
  }

  async changeActivity(
    lobbyId: LobbyId,
    playerId: PlayerId,
    to: 'spectate' | 'active',
  ): Promise<Result<PublicLobby, string>> {
    return this.#getLobby(lobbyId)
      .then(unwrapOrThrow)
      .then(
        guardPromise((x) => x.state === 'waiting', 'Lobby should be waiting'),
      )
      .then((x: WaitingLobby) => {
        if (to === 'active') {
          if (x.players.length >= MAX_PLAYERS)
            return Result.err('Too many active players');
          else
            return Result.ok({
              ...x,
              players: R.uniq([...x.players, playerId]),
              spectators: x.spectators.filter((y) => y !== playerId),
            });
        } else {
          return Result.ok({
            ...x,
            players: x.players.filter((y) => y !== playerId),
            spectators: R.uniq([...x.spectators, playerId]),
          });
        }
      })
      .then(unwrapOrThrow)
      .then((lobby) => this.#syncLobbyEffect(lobbyId, lobby))
      .then(toPublicLobby)
      .then((x) => Result.ok(x))
      .catch(catchPromise);
  }

  async joinLobby(
    lobbyId: LobbyId,
    playerId: PlayerId,
  ): Promise<Result<PublicLobby, string>> {
    const lobby = await this.#getLobby(lobbyId)
      .then(unwrapOrThrow)
      .then((x: Lobby): Lobby => {
        if (x.players.includes(playerId) || x.spectators.includes(playerId)) {
          return x;
        } else if (x.state === 'waiting' && x.players.length < MAX_PLAYERS) {
          return { ...x, players: R.uniq([...x.players, playerId]) };
        } else {
          return { ...x, spectators: R.uniq([...x.spectators, playerId]) };
        }
      })
      .then((lobby) => this.#syncLobbyEffect(lobbyId, lobby))
      .then(toPublicLobby)
      .then((x) => Result.ok(x))
      .catch(catchPromise);

    return lobby;
  }

  async start(
    lobbyId: LobbyId,
    playerId: PlayerId,
  ): Promise<
    Result<{ lobby: PublicLobby; deltas: PublicGameDelta[] }, string>
  > {
    const deltas: Result<PublicGameDelta[], string> = await this.#getLobby(
      lobbyId,
    )
      .then(unwrapOrThrow)
      .then(
        R.pipe(
          guardPromise(
            (x: Lobby) => x.state === 'waiting',
            'Game already started',
          ),
          (x) => x as WaitingLobby,
        ),
      )
      .then(
        R.pipe(
          guardPromise(
            (x) => x.players.length === MAX_PLAYERS,
            'Not enough players',
          ),
          guardPromise(
            (x) => x.creator === playerId,
            'Only the creator can start',
          ),
        ),
      )
      .then(
        (lobby): Game => ({
          gun: [],
          maxPlayerItems: MAX_PLAYER_ITEMS,
          playerStates: lobby.players.map((pid, i) => ({
            id: pid,
            items: R.repeat(Item.nothing, MAX_PLAYER_ITEMS),
            health: 10,
            turn: i,
            statuses: [],
          })),
          turn: 0,
          settings: lobby.settings,
        }),
      )
      .then(
        (game): Result<GameDeltas, string> =>
          Result.ok([{ game, delta: { type: 'noop' } }]),
      )
      .then((deltas) => forwardDeltaResults(forwardNextRound, deltas))
      .then(unwrapOrThrow)
      .then((delta) => this.#syncDeltaEffect(lobbyId, delta))
      .then(toPublicDeltas)
      .then((x) => Result.ok(x))
      .catch(catchPromise);

    const lobby = await this.#getLobby(lobbyId).then(map(toPublicLobby));

    const joinLobbyDelta =
      (lobby: PublicLobby) => (deltas: PublicGameDelta[]) => ({
        lobby,
        deltas,
      });

    return Result.ok<typeof joinLobbyDelta, string>(joinLobbyDelta)
      .ap(lobby)
      .ap(deltas);
  }

  async updateGame(
    lobbyId: string,
    player: PlayerId,
    actionUnsafe: any,
  ): Promise<Result<PublicGameDelta[], string>> {
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
      .then(
        (game): Result<GameDeltas, string> =>
          Result.ok([{ game, delta: { type: 'noop' } }]),
      )
      .then((deltas) =>
        forwardDeltaResults(
          (game) => handleAction(action, player, game),
          deltas,
        ),
      )
      .then((deltas) => forwardDeltaResults(forwardPreTransferControls, deltas))
      .then(unwrapOrThrow)
      .then((delta) => this.#syncDeltaEffect(lobbyId, delta))
      .then(toPublicDeltas)
      .then((x) => Result.ok(x))
      .catch(catchPromise);
  }
}
