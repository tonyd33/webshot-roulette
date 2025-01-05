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
  Lobby,
  PublicLobby,
  GameSettings,
  Delta,
  ActionType,
} from '@shared/game/types';
import { MAX_ROUND_ITEM_REFILL } from './game.constants';
import { ensureUnreachable, isDefined } from '@shared/typescript';
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
  const numPlayers = game.playerStates.length;
  const numDead = game.playerStates.filter((p) => p.health <= 0).length;
  return numDead + 1 >= numPlayers;
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

export function toPublicGame(game: Game): PublicGame {
  const { gun: _gun, ...rest } = game;
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

// #region Deltas and applications

/**
 * We can only construct the next game state from a delta for some deltas.
 * Reloading, for example, does not contain enough information to
 * deterministically give us the next state.
 *
 * TODO: Support all deterministic deltas
 */
export type DeterministicDelta = Extract<
  Delta,
  { type: 'noop' | 'statusChanges' | 'itemChanges' | 'hurt' }
>;
/**
 * Useful for when we need to generate multiple deltas, but the delta generated
 * depends on the _current_ state of the game. In such a case, the current state
 * of the game is lazy loaded into the game argument.
 */
export type Lazy<T> = (game: Game) => T;

const flattenDeltas = (d1: GameDeltas) => (d2: GameDeltas) => [...d1, ...d2];

/**
 * Given the current GameDeltas, try to apply `forward` on the latest
 * `GameDelta.game` and then concatenate the inner `GameDeltas`.
 *
 * Can be thought of as a monadic bind operation on Result<GameDeltas, string>.
 */
export const forwardDeltaResults = R.curryN(
  2,
  function (
    forward: (game: Game) => Result<GameDeltas, string>,
    deltas: Result<GameDeltas, string>,
  ): Result<GameDeltas, string> {
    const subsequentDeltas = deltas.andThen(getLatestGame).andThen(forward);
    return Result.ok<typeof flattenDeltas, string>(flattenDeltas)
      .ap(deltas)
      .ap(subsequentDeltas);
  },
);

export function applyLazyDeltas(
  game: Game,
  lazyDeltas: Lazy<DeterministicDelta[]>[],
) {
  const initial = Result.ok([{ game, delta: { type: 'noop' as const } }]);
  return lazyDeltas.reduce(
    (deltas, lazyDelta) =>
      forwardDeltaResults((game) => applyDeltas(game, lazyDelta(game)), deltas),
    initial,
  );
}

export function applyDeltas(
  game: Game,
  deltas: DeterministicDelta[],
): Result<GameDeltas, string> {
  const initial = Result.ok([{ game, delta: { type: 'noop' as const } }]);
  if (deltas.length === 0) return initial;

  return deltas.reduce(
    (delta, currDeltas) =>
      forwardDeltaResults((game) => applyDelta(game, currDeltas), delta),
    initial,
  );
}

export const applyDelta = R.curryN(
  2,
  function (
    game: Game,
    delta: Extract<
      Delta,
      { type: 'noop' | 'statusChanges' | 'itemChanges' | 'hurt' }
    >,
  ): Result<GameDeltas, string> {
    switch (delta.type) {
      case 'noop':
        return Result.ok([{ game, delta }]);
      case 'statusChanges':
        return applyPlayerStatusChangesDelta(game, delta);
      case 'itemChanges':
        return applyPlayerItemChangesDelta(game, delta);
      case 'hurt':
        return applyHurtDelta(game, delta);
      default:
        ensureUnreachable(delta);
    }
  },
);

function applyHurtDelta(
  game: Game,
  delta: Extract<Delta, { type: 'hurt' }>,
): Result<GameDeltas, string> {
  return Result.ok([
    {
      game: {
        ...game,
        playerStates: game.playerStates.map((p) => {
          if (p.id !== delta.who) return p;
          return {
            ...p,
            health: p.health - delta.dmg,
          };
        }),
      },
      delta,
    },
  ]);
}

function applyPlayerItemChangesDelta(
  game: Game,
  delta: Extract<Delta, { type: 'itemChanges' }>,
): Result<GameDeltas, string> {
  return Result.ok([
    {
      game: {
        ...game,
        playerStates: game.playerStates.map((p) => {
          const itemChangesForPlayer = delta.itemChanges.filter(
            (i) => i.playerId === p.id,
          );
          const newItems = itemChangesForPlayer.reduce(
            (acc, val) => replaceInArrayIdx(val.item, val.slot, acc),
            p.items,
          );
          return { ...p, items: newItems };
        }),
      },
      delta,
    },
  ]);
}

export function applyPlayerStatusChangesDelta(
  game: Game,
  delta: Extract<Delta, { type: 'statusChanges' }>,
): Result<GameDeltas, string> {
  // this fucking sucks lol. but it works and my eyes are free of this mess 99%
  // of the time so I'm gonna ignore it.
  // TODO: make it better
  return Result.ok([
    {
      game: {
        ...game,
        playerStates: game.playerStates.map((player) => {
          const statusChangesForPlayer = delta.statusChanges.filter(
            (s) => s.playerId === player.id,
          );
          const updatedExistingStatuses = player.statuses
            .filter(
              // rm status
              (status) =>
                !statusChangesForPlayer.find(
                  (change) =>
                    change.type === 'rm' && change.index === status.index,
                ),
            )
            .map((status) => {
              // update status
              const newStatus = statusChangesForPlayer.find(
                (change) =>
                  change.type === 'upsert' &&
                  change.status.index === status.index,
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
      },
      delta,
    },
  ]);
}
// #endregion

// #region miscellaneous
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

export function getAvailableActions(
  player: PlayerId,
  game: Game,
): ActionType[] {
  const availableActions: Result<ActionType[], string> = findPlayer(
    player,
    game,
  ).map((p: PlayerState) =>
    p.statuses.find((s) => s.type === 'handcuffed')
      ? [ActionType.pass]
      : Object.values(ActionType),
  );

  return availableActions.unwrapOr([]);
}

// #endregion
