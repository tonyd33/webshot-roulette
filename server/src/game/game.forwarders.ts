import * as R from 'ramda';
import {
  PlayerId,
  Game,
  GameDeltas,
  PlayerStatusChange,
  StatusType,
  GameDelta,
  Bullet,
  Delta,
  Item,
} from '@shared/game/types';
import Result from '@shared/true-myth/result';
import {
  applyLazyDeltas,
  applyPlayerStatusChangesDelta,
  DeterministicDelta,
  doneGame,
  forwardDeltaResults,
  generateRefillPlayersDelta,
  generateStatusIndex,
  Lazy,
} from './game.utils';

export function forwardStripSawedStatus(
  player: PlayerId,
  game: Game,
): Result<GameDeltas, string> {
  const statusChanges: PlayerStatusChange[] = game.playerStates
    .flatMap((p) => {
      if (p.id !== player) return [];
      return p.statuses.filter((s) => s.type === StatusType.sawed);
    })
    .map((s) => ({ type: 'rm', index: s.index, playerId: player }));

  return applyPlayerStatusChangesDelta(game, {
    type: 'statusChanges',
    statusChanges,
  });
}

export function forwardStartTurn(game: Game): Result<GameDeltas, string> {
  return Result.ok([{ game, delta: { type: 'noop' } }]);
}

export function forwardEndTurn(game: Game): Result<GameDeltas, string> {
  return forwardEndOfTurnStatusChanges(game);
}
export function forwardNextTurn(game: Game): Result<GameDeltas, string> {
  return R.flow(Result.ok([{ game: game, delta: { type: 'noop' as const } }]), [
    (deltas) => forwardDeltaResults(forwardEndTurn, deltas),
    (deltas) =>
      forwardDeltaResults((game) => {
        const newTurn = (game.turn + 1) % game.playerStates.length;
        return Result.ok([
          {
            game: { ...game, turn: newTurn },
            delta: { type: 'pass', turn: newTurn },
          },
        ]);
      }, deltas),
    (deltas) => forwardDeltaResults(forwardStartTurn, deltas),
  ]);
}

export function forwardNextRound(game: Game): Result<GameDeltas, string> {
  // reload gun
  const lives: Bullet[] = R.repeat('live', Math.floor(Math.random() * 4) + 1);
  const blanks: Bullet[] = R.repeat('blank', Math.floor(Math.random() * 4) + 1);
  // shuffle gun
  const gun = R.flow(R.concat(lives, blanks), [
    R.sortBy(() => Math.random() - 0.5),
  ]);

  const reloadDelta: GameDelta = {
    game: { ...game, gun },
    delta: { type: 'reload', lives: lives.length, blanks: blanks.length },
  };

  // give items
  return forwardDeltaResults(
    generateRefillPlayersDelta,
    Result.ok([reloadDelta]),
  );
}

/**
 * Things that should happen before transferring control back to the player.
 * TODO: Squash multiple itemChanges and statusChanges into one
 */
export function forwardPreTransferControls(
  game: Game,
): Result<GameDeltas, string> {
  if (doneGame(game)) {
    const winner = game.playerStates.find((p) => p.health > 0)?.id;
    if (!winner) return Result.err('Programmer is an idiot, sorry');
    return Result.ok([{ game, delta: { type: 'gg', winner: winner } }]);
  } else if (game.gun.length === 0) {
    return forwardNextRound(game);
  } else {
    return Result.ok([{ game, delta: { type: 'noop' } }]);
  }
}

export function forwardEndOfTurnStatusChanges(
  outerGame: Game,
): Result<GameDeltas, string> {
  // fuck it, we're flattening all status changes into a single array as opposed
  // to a arrays of an array of singular status changes for atomicity of
  // status changes. doesn't really make a difference right now anyhow, since
  // status changes are associative
  const lazyDeltas = outerGame.playerStates.flatMap((player) =>
    player.statuses.flatMap(
      (status): Lazy<DeterministicDelta[]> =>
        (game: Game) => {
          const turns = status.turns ?? Number.POSITIVE_INFINITY;
          const upsertedStatus = {
            type: 'statusChanges' as const,
            statusChanges: [
              {
                playerId: player.id,
                type: 'upsert' as const,
                status: {
                  ...status,
                  turns: turns - 1,
                },
              },
            ],
          };
          const removedStatus = {
            type: 'statusChanges' as const,
            statusChanges: [
              {
                playerId: player.id,
                type: 'rm' as const,
                index: status.index,
              },
            ],
          };
          switch (status.type) {
            case StatusType.handcuffed: {
              if (turns > 0) return [upsertedStatus];
              else {
                const slipperyIndex = generateStatusIndex();
                return [
                  removedStatus,
                  ...(game.settings.handcuffCooldownTurns >= 1
                    ? [
                        {
                          type: 'statusChanges' as const,
                          statusChanges: [
                            {
                              playerId: player.id,
                              type: 'upsert' as const,
                              status: {
                                type: StatusType.slipperyHands,
                                turns: game.settings.handcuffCooldownTurns - 1,
                                index: slipperyIndex,
                              },
                            },
                          ],
                        },
                      ]
                    : []),
                ];
              }
            }
            // alright, clean this fuckin shit ass code up
            // TODO: Clean up code
            case StatusType.hotPotatoReceiver: {
              if (turns > 0) return [upsertedStatus];
              const updatedPlayer = game.playerStates.find(
                (p) => p.id === player.id,
              )!;
              const firstEmptySlotIndex = updatedPlayer.items.findIndex(
                (i) => i === Item.nothing,
              );
              if (firstEmptySlotIndex === -1) {
                return [
                  removedStatus,
                  { type: 'hurt', dmg: 1, who: player.id },
                ];
              } else {
                return [
                  removedStatus,
                  {
                    type: 'itemChanges',
                    itemChanges: [
                      {
                        playerId: player.id,
                        slot: firstEmptySlotIndex,
                        item: Item.hotPotato,
                      },
                    ],
                  },
                ];
              }
            }
            default:
              return [turns > 0 ? upsertedStatus : removedStatus];
          }
        },
    ),
  );

  return applyLazyDeltas(outerGame, lazyDeltas);
}
