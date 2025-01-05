import * as randomstring from 'randomstring';
import * as R from 'ramda';
import Result from '@shared/true-myth/result';
import {
  Game,
  GameDelta,
  GameDeltas,
  Item,
  PlayerState,
  PublicGameDelta,
  PublicGame,
  PlayerId,
  PlayerStatusChange,
  StatusType,
  Lobby,
  PublicLobby,
  GameSettings,
} from '@shared/game/types';
import { MAX_ROUND_ITEM_REFILL } from './game.constants';
import { isDefined } from '@shared/typescript';
import { find as maybeFind } from '@shared/true-myth/maybe';

export function replaceInArray<X>(
  with_: X,
  by: (a: X, b: X) => boolean,
  arr: X[],
) {
  return arr.map((x) => (by(x, with_) ? with_ : x));
}

export function replaceInArrayIdx<X>(with_: X, by: number, arr: X[]) {
  return arr.map((x, i) => (i === by ? with_ : x));
}

export function playerIdEq(p1: PlayerState, p2: PlayerState) {
  return p1.id === p2.id;
}

export function getLatestGame(deltas: GameDelta[]): Result<Game, string> {
  return deltas.length > 0
    ? Result.ok(deltas[deltas.length - 1].game)
    : Result.err('No delta');
}

export function doneGame(game: Game): boolean {
  return !!game.playerStates.find((p) => p.health <= 0);
}

export function findPlayer(
  player: PlayerId,
  game: Game,
): Result<PlayerState, string> {
  const targetPlayer: Result<PlayerState, string> = maybeFind(
    (p) => p.id === player,
    game.playerStates,
  )
    .map((p) => Result.ok(p))
    .unwrapOr(Result.err('No player'));
  return targetPlayer;
}

export function replacePlayerItemDelta(
  player: PlayerId,
  slot: number,
  item: Item,
  game: Game,
): Result<GameDeltas, string> {
  return Result.ok({
    game: {
      ...game,
      playerStates: game.playerStates.map((p) =>
        p.id === player
          ? {
              ...p,
              items: replaceInArrayIdx(item, slot, p.items),
            }
          : p,
      ),
    },
    delta: {
      type: 'itemChanges' as const,
      itemChanges: [{ playerId: player, slot, item }],
    },
  }).map((x) => [x]);
}

export function toPublicGame(game: Game): PublicGame {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { gun, ...rest } = game;
  return rest;
}

export function toPublicDeltas(deltas: GameDeltas): PublicGameDelta[] {
  return deltas
    .filter(
      (x) =>
        !(
          x.delta.type === 'noop' ||
          (x.delta.type === 'statusChanges' &&
            x.delta.statusChanges.length === 0) ||
          (x.delta.type === 'itemChanges' && x.delta.itemChanges.length === 0)
        ),
    )
    .map((x) => ({
      ...x,
      game: toPublicGame(x.game),
    }));
}

export function toPublicLobby(lobby: Lobby): PublicLobby {
  switch (lobby.state) {
    case 'waiting':
      return { mark: 'public' as const, ...lobby };
    case 'active':
      return {
        mark: 'public' as const,
        ...lobby,
        game: toPublicGame(lobby.game),
      };
  }
}

export function pickRandom<X>(arr: X[], n: number) {
  return R.range(0, n)
    .map(() => Math.floor(Math.random() * arr.length))
    .map((i) => arr[i]);
}

export function refillPlayerItems(settings: GameSettings, player: PlayerState) {
  const needsNumItems = Math.min(
    player.items.filter((x) => x === Item.nothing).length,
    MAX_ROUND_ITEM_REFILL,
  );
  const randomItems = pickRandom(settings.itemDistribution, needsNumItems);

  const items: Item[] = [];
  const itemChanges: { slot: number; item: Item }[] = [];
  let randomIdx = 0;

  for (let i = 0; i < player.items.length; i++) {
    const item = player.items[i];
    if (item === Item.nothing && randomIdx < needsNumItems) {
      const randomItem = randomItems[randomIdx++];
      items.push(randomItem);
      itemChanges.push({ slot: i, item: randomItem });
    } else {
      items.push(item);
    }
  }

  return { items, itemChanges };
}

const flattenDeltas = (d1: GameDeltas) => (d2: GameDeltas) => [...d1, ...d2];

export function forwardDeltaResults(
  forward: (game: Game) => Result<GameDeltas, string>,
  deltas: Result<GameDeltas, string>,
): Result<GameDeltas, string> {
  const subsequentDeltas = deltas.andThen(getLatestGame).andThen(forward);
  return Result.ok<typeof flattenDeltas, string>(flattenDeltas)
    .ap(deltas)
    .ap(subsequentDeltas);
}

export function generateEndOfTurnStatusDeltas(
  game: Game,
): Result<GameDeltas, string> {
  // fuck it, we're flattening all status changes into a single array as opposed
  // to a arrays of an array of singular status changes for atomicity of
  // status changes. doesn't really make a difference right now anyhow, since
  // status changes are associative
  const bigStatusChanges: PlayerStatusChange[] = game.playerStates.flatMap(
    (player) =>
      player.statuses.flatMap((status): PlayerStatusChange[] => {
        const turns = status.turns ?? Number.POSITIVE_INFINITY;
        const upsertedStatus = {
          playerId: player.id,
          type: 'upsert' as const,
          status: {
            ...status,
            turns: turns - 1,
          },
        };
        const removedStatus = {
          playerId: player.id,
          type: 'rm' as const,
          index: status.index,
        };
        switch (status.type) {
          case StatusType.handcuffed: {
            if (turns > 0) {
              return [upsertedStatus];
            } else {
              const slipperyIndex = generateStatusIndex();
              return [
                removedStatus,
                ...(game.settings.handcuffCooldownTurns >= 1
                  ? [
                      {
                        playerId: player.id,
                        type: 'upsert' as const,
                        status: {
                          type: StatusType.slipperyHands,
                          turns: game.settings.handcuffCooldownTurns - 1,
                          index: slipperyIndex,
                        },
                      },
                    ]
                  : []),
              ];
            }
          }
          default:
            return [turns > 0 ? upsertedStatus : removedStatus];
        }
      }),
  );

  return Result.ok({
    game: applyPlayerStatusChanges(game, bigStatusChanges),
    delta: { type: 'statusChanges' as const, statusChanges: bigStatusChanges },
  }).map((x) => [x]);
}

export function applyPlayerStatusChanges(
  game: Game,
  statusChanges: PlayerStatusChange[],
): Game {
  // this fucking sucks lol. but it works and my eyes are free of this mess 99%
  // of the time so I'm gonna ignore it.
  // TODO: make it better
  return {
    ...game,
    playerStates: game.playerStates.map((player) => {
      const statusChangesForPlayer = statusChanges.filter(
        (s) => s.playerId === player.id,
      );
      const updatedExistingStatuses = player.statuses
        .filter(
          // rm status
          (status) =>
            !statusChangesForPlayer.find(
              (change) => change.type === 'rm' && change.index === status.index,
            ),
        )
        .map((status) => {
          // update status
          const newStatus = statusChangesForPlayer.find(
            (change) =>
              change.type === 'upsert' && change.status.index === status.index,
          );
          if (newStatus?.type !== 'upsert') return status;
          return newStatus.status;
        });
      const existingStatusesIndexes = updatedExistingStatuses.map(
        (x) => x.index,
      );
      const newStatuses = statusChangesForPlayer
        .map((s) =>
          s.type === 'upsert' &&
          !existingStatusesIndexes.includes(s.status.index)
            ? s.status
            : null,
        )
        .filter(isDefined);
      return {
        ...player,
        statuses: [...updatedExistingStatuses, ...newStatuses],
      };
    }),
  };
}

export function generateRefillPlayersDelta(
  game: Game,
): Result<GameDeltas, string> {
  const deltas: GameDeltas = [];
  let currGame = game;
  for (const player of game.playerStates) {
    const { items, itemChanges } = refillPlayerItems(game.settings, player);
    currGame = {
      ...game,
      playerStates: replaceInArray(
        { ...player, items },
        playerIdEq,
        currGame.playerStates,
      ),
    };
    deltas.push({
      game: currGame,
      delta: {
        type: 'itemChanges',
        itemChanges: itemChanges.map((i) => ({ ...i, playerId: player.id })),
      },
    });
  }

  return Result.ok(deltas);
}

export function generateStatusIndex() {
  return randomstring.generate(16);
}
