import * as R from 'ramda';
import {
  PlayerId,
  Game,
  GameDeltas,
  PlayerStatusChange,
  StatusType,
  GameDelta,
  Bullet,
} from '@shared/game/types';
import Result from '@shared/true-myth/result';
import {
  applyPlayerStatusChanges,
  doneGame,
  forwardDeltaResults,
  generateEndOfTurnStatusDeltas,
  generateRefillPlayersDelta,
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

  return Result.ok([
    {
      game: applyPlayerStatusChanges(game, statusChanges),
      delta: { type: 'statusChanges', statusChanges },
    },
  ]);
}

export function forwardStartTurn(game: Game): Result<GameDeltas, string> {
  return Result.ok([{ game, delta: { type: 'noop' } }]);
}

export function forwardEndTurn(game: Game): Result<GameDeltas, string> {
  return generateEndOfTurnStatusDeltas(game);
}
export function forwardNextTurn(game: Game): Result<GameDeltas, string> {
  let out: Result<GameDeltas, string> = Result.ok([
    { game: game, delta: { type: 'noop' } },
  ]);
  out = forwardDeltaResults(forwardEndTurn, out);
  out = forwardDeltaResults((game) => {
    const newTurn = (game.turn + 1) % game.playerStates.length;
    return Result.ok([
      {
        game: { ...game, turn: newTurn },
        delta: { type: 'pass', turn: newTurn },
      },
    ]);
  }, out);
  out = forwardDeltaResults(forwardStartTurn, out);
  return out;
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

/** Things that should happen before transferring control back to the player */
export function forwardPreTransferControls(
  game: Game,
): Result<GameDeltas, string> {
  if (doneGame(game)) {
    return Result.ok([{ game, delta: { type: 'gg' } }]);
  } else if (game.gun.length === 0) {
    return forwardNextRound(game);
  } else {
    return Result.ok([{ game, delta: { type: 'noop' } }]);
  }
}
