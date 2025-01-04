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
  Waiting,
  Game,
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
} from './game.utils';
import {
  handleAction,
  handleNextRound,
  handlePreTransferControl,
} from './game.handlers';

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

    const lobby = await this.getLobby(lobbyId).then(unwrapOrThrow);

    await this.#syncLobbyEffect(lobbyId, {
      ...lobby,
      state: 'active',
      game: latestGame.value,
    });
    return deltas;
  }

  async getLobby(lobbyId: LobbyId): Promise<Result<Lobby, string>> {
    return this.redis
      .get(lobbyId)
      .then((x) => (x ? Result.ok(x) : Result.err('Could not find lobby')))
      .then(map(JSON.parse))
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

  async createLobby(): Promise<Result<Lobby, string>> {
    const lobbyId: LobbyId =
      `${randomstring.generate(3)}-${randomstring.generate(3)}`.toLowerCase();
    const lobby: Lobby = {
      id: lobbyId,
      state: 'waiting',
      players: [],
      spectators: [],
    };
    await this.#syncLobbyEffect(lobbyId, lobby);

    return Result.ok(lobby);
  }

  async getOrCreateLobby(lobbyId: LobbyId): Promise<Result<Lobby, string>> {
    const existingLobby = await this.getLobby(lobbyId);
    if (existingLobby.isOk) {
      return existingLobby;
    } else {
      return this.createLobby();
    }
  }

  async changeActivity(
    lobbyId: LobbyId,
    playerId: PlayerId,
    to: 'spectate' | 'active',
  ): Promise<Result<Lobby, string>> {
    return this.getLobby(lobbyId)
      .then(unwrapOrThrow)
      .then(
        guardPromise((x) => x.state === 'waiting', 'Lobby should be waiting'),
      )
      .then((x: Waiting) => {
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
      });
  }

  async joinLobby(
    lobbyId: LobbyId,
    playerId: PlayerId,
  ): Promise<Result<Lobby, string>> {
    // TODO: Make this get only
    const lobby = await this.getOrCreateLobby(lobbyId)
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
      .then((x) => Result.ok(x))
      .catch(catchPromise);

    return lobby;
  }

  async start(
    lobbyId: LobbyId,
  ): Promise<Result<{ lobby: Lobby; deltas: PublicGameDelta[] }, string>> {
    const deltas: Result<PublicGameDelta[], string> = await this.getLobby(
      lobbyId,
    )
      .then(unwrapOrThrow)
      .then(
        R.pipe(
          guardPromise(
            (x: Lobby) => x.state === 'waiting',
            'Game already started',
          ),
          (x) => x as Waiting,
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
        }),
      )
      .then(
        (game): Result<GameDeltas, string> =>
          Result.ok([{ game, delta: { type: 'noop' } }]),
      )
      .then((deltas) => forwardDeltaResults(handleNextRound, deltas))
      .then(unwrapOrThrow)
      .then((delta) => this.#syncDeltaEffect(lobbyId, delta))
      .then(toPublicDeltas)
      .then((x) => Result.ok(x))
      .catch(catchPromise);

    const lobby = await this.getLobby(lobbyId);

    const joinLobbyDelta = (lobby: Lobby) => (deltas: PublicGameDelta[]) => ({
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
      .then((deltas) => forwardDeltaResults(handlePreTransferControl, deltas))
      .then(unwrapOrThrow)
      .then((delta) => this.#syncDeltaEffect(lobbyId, delta))
      .then(toPublicDeltas)
      .then((x) => Result.ok(x))
      .catch(catchPromise);
  }
}
