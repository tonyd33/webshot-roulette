import * as R from 'ramda';
import Result from '@shared/true-myth/result';
import {
  Action,
  ActionType,
  Bullet,
  Delta,
  Game,
  GameDelta,
  GameDeltas,
  Item,
  PlayerId,
  PlayerState,
  Status,
  StatusType,
} from '@shared/game/types';
import { firstRest, pop } from '@shared/true-myth/addons';
import Maybe, { find } from '@shared/true-myth/maybe';
import { ensureUnreachable, matchlike } from '@shared/typescript';
import {
  doneGame,
  forwardDeltaResults,
  generateEndOfTurnStatusDeltas,
  generateRefillPlayersDelta,
  generateStatusIndex,
  playerIdEq,
  replaceInArray,
  replacePlayerItemDelta,
} from './game.utils';

function handleTurnStart(game: Game): Result<GameDeltas, string> {
  return generateEndOfTurnStatusDeltas(game);
}

function handleTurnEnd(game: Game): Result<GameDeltas, string> {
  return Result.ok([{ game, delta: { type: 'noop' } }]);
}

export function handleNextTurn(game: Game): Result<GameDeltas, string> {
  let out: Result<GameDeltas, string> = Result.ok([
    { game: game, delta: { type: 'noop' } },
  ]);
  out = forwardDeltaResults(handleTurnEnd, out);
  out = forwardDeltaResults((game) => {
    const newTurn = (game.turn + 1) % game.playerStates.length;
    return Result.ok([
      {
        game: { ...game, turn: newTurn },
        delta: { type: 'pass', turn: newTurn },
      },
    ]);
  }, out);
  out = forwardDeltaResults(handleTurnStart, out);
  return out;
}

function handleShoot(
  player: PlayerId,
  game: Game,
  action: Extract<Action, { type: 'shoot' }>,
): Result<GameDeltas, string> {
  const [bullet, ...rest] = game.gun;
  const effect: Delta = {
    type: 'shoot',
    who: action.who,
    bullet: bullet,
    hurt: bullet === 'live' ? 1 : 0,
  };
  let deltas: Result<GameDeltas, string>;
  if (bullet === 'blank') {
    deltas = Result.ok([{ game: { ...game, gun: rest }, delta: effect }]);
  } else {
    deltas = pop<PlayerState>((x) => x.id === action.who, game.playerStates)
      .mapErr(() => 'Shooting nobody')
      .map(([player, rest]) => [
        { ...player, health: player.health - 1 },
        ...rest,
      ])
      .map((playerStates) => [
        {
          game: { ...game, gun: rest, playerStates },
          delta: effect,
        },
      ]);
  }

  // If shooting self and blank, its still their turn
  if (action.who === player && bullet === 'blank') {
    return deltas;
  } else {
    return forwardDeltaResults(handleNextTurn, deltas);
  }
}

function handleUseItem(
  player: PlayerId,
  game: Game,
  action: Extract<Action, { type: 'useItem' }>,
) {
  const playerState: Maybe<PlayerState> = find(
    (x) => x.id === player,
    game.playerStates,
  );
  const item: Maybe<Item> = playerState
    .andThen((p) => Maybe.of(p.items[action.which]))
    .andThen((i) => (i === Item.nothing ? Maybe.nothing() : Maybe.just(i)));

  if (playerState.isNothing) return Result.err('No player');
  if (item.isNothing) return Result.err('No item');
  if (item.value !== action.item) return Result.err('Mismatching item');

  // remove item
  let out = replacePlayerItemDelta(player, action.which, Item.nothing, game);
  // then apply the item
  out = forwardDeltaResults(
    (game) => handleApplyItem(player, game, action),
    out,
  );
  return out;
}

/** Assume the item has been validated to exist */
function handleApplyItem(
  player: PlayerId,
  game: Game,
  action: Extract<Action, { type: 'useItem' }>,
): Result<GameDeltas, string> {
  const playerRes: Result<PlayerState, string> = find(
    (p) => p.id === player,
    game.playerStates,
  )
    .map((x) => Result.ok(x))
    .unwrapOr(Result.err('A ghost!'));

  let delta: Result<GameDelta, string>;
  switch (action.item) {
    case Item.pop:
      delta = firstRest(game.gun).map(
        ([first, rest]): GameDelta => ({
          game: { ...game, gun: rest },
          delta: { type: 'pop', bullet: first },
        }),
      );
      break;
    case Item.magnifyingGlass:
      delta = firstRest(game.gun).map(
        ([first, rest]): GameDelta => ({
          game: { ...game, gun: [first, ...rest] },
          delta: { type: 'inspect', bullet: first },
        }),
      );
      break;
    case Item.apple:
      delta = playerRes
        .andThen((p) =>
          p.health >= 10 ? Result.err("You're too full") : Result.ok(p),
        )
        .map(() => ({
          game: {
            ...game,
            playerStates: game.playerStates.map((x) => {
              if (x.id !== player) return x;
              return {
                ...x,
                health: x.health + 1,
              };
            }),
          },
          delta: { type: 'nomnom', who: player, heal: 1 },
        }));
      break;
    case Item.handcuff: {
      const player: Result<PlayerState, string> = find(
        (p) => p.id === action.who,
        game.playerStates,
      )
        .map((p) => Result.ok(p))
        .unwrapOr(Result.err('No player'));

      delta = player
        .andThen((p) =>
          p.statuses.find((s) => s.type === StatusType.handcuffed)
            ? Result.err('Already handcuffed')
            : Result.ok(p),
        )
        .andThen((p) =>
          p.statuses.find((s) => s.type === StatusType.slipperyHands)
            ? Result.err("Dude has slippery hands, can't cuff 'em")
            : Result.ok(p),
        )
        .map((p) => {
          const status: Status = {
            index: generateStatusIndex(),
            type: StatusType.handcuffed,
            turns: 1,
          };
          return {
            game: {
              ...game,
              playerStates: replaceInArray(
                { ...p, statuses: [...p.statuses, status] },
                playerIdEq,
                game.playerStates,
              ),
            },
            delta: {
              type: 'statusChanges',
              statusChanges: [{ playerId: p.id, type: 'upsert', status }],
            },
          };
        });
      break;
    }
    default:
      return ensureUnreachable(action);
  }
  return delta.map((x) => [x]);
}

export function handleAction(
  action: Action,
  player: PlayerId,
  game: Game,
): Result<GameDeltas, string> {
  const availableActions: Result<ActionType[], string> = find(
    (p) => p.id === player,
    game.playerStates,
  )
    .map((p) => Result.ok(p))
    .unwrapOr(Result.err('No player'))
    .map((p: PlayerState) =>
      p.statuses.find((s) => s.type === 'handcuffed')
        ? [ActionType.pass]
        : Object.values(ActionType),
    );

  return availableActions
    .andThen((actions: ActionType[]) =>
      actions.includes(action.type)
        ? Result.ok()
        : Result.err('This action is not available to you'),
    )
    .andThen(() =>
      matchlike(action)('type')({
        shoot: (x) => handleShoot(player, game, x),
        pass: () => handleNextTurn(game),
        useItem: (x) => handleUseItem(player, game, x),
      }),
    );
}

export function handleNextRound(game: Game): Result<GameDeltas, string> {
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
export function handlePreTransferControl(
  game: Game,
): Result<GameDeltas, string> {
  if (doneGame(game)) {
    return Result.ok([{ game, delta: { type: 'gg' } }]);
  } else if (game.gun.length === 0) {
    return handleNextRound(game);
  } else {
    return Result.ok([{ game, delta: { type: 'noop' } }]);
  }
}
