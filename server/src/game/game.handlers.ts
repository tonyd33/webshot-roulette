import * as R from 'ramda';
import Result from '@shared/true-myth/result';
import {
  Action,
  ActionType,
  Delta,
  Game,
  GameDeltas,
  HandsawDamageStackBehavior,
  Item,
  PlayerId,
  PlayerState,
  StatusType,
} from '@shared/game/types';
import { popItem } from '@shared/true-myth/addons';
import Maybe, { find as maybeFind } from '@shared/true-myth/maybe';
import { ensureUnreachable, matchlike } from '@shared/typescript';
import {
  applyDelta,
  doneGame,
  findPlayer,
  forwardDeltaResults,
  getAvailableActions,
} from './game.utils';
import { forwardNextTurn, forwardStripSawedStatus } from './game.forwarders';
import {
  forwardApplyApple,
  forwardApplyHandcuff,
  forwardApplyHandsaw,
  forwardApplyHotPotato,
  forwardApplyInverter,
  forwardApplyMagnifyingGlass,
  forwardApplyPop,
} from './game.item-forwarders';

function handleShoot(
  player: PlayerId,
  game: Game,
  action: Extract<Action, { type: 'shoot' }>,
): Result<GameDeltas, string> {
  const [bullet, ...rest] = game.gun;

  // get multiplier based on settings
  const multiplier = findPlayer(player, game)
    .map((p) =>
      p.statuses.reduce((acc, s) => {
        if (s.type !== StatusType.sawed) return acc;
        switch (game.settings.handsawDamageStackBehavior) {
          case HandsawDamageStackBehavior.add:
            return acc + 1;
          case HandsawDamageStackBehavior.multiply:
            return acc * 2;
          default:
            ensureUnreachable(game.settings.handsawDamageStackBehavior);
        }
      }, 1),
    )
    .unwrapOr(1);

  const damage = (bullet === 'live' ? 1 : 0) * multiplier;
  const delta: Delta = {
    type: 'shoot',
    who: action.who,
    bullet: bullet,
    hurt: damage,
  };

  let deltas: Result<GameDeltas, string>;
  if (bullet === 'blank') {
    deltas = Result.ok([{ game: { ...game, gun: rest }, delta }]);
  } else {
    deltas = popItem<PlayerState>((x) => x.id === action.who, game.playerStates)
      .mapErr(() => 'Shooting nobody')
      .map(([player, rest]) => [
        { ...player, health: player.health - damage },
        ...rest,
      ])
      .map((playerStates) => [
        {
          game: { ...game, gun: rest, playerStates },
          delta,
        },
      ]);
  }

  // no matter what, the handsaw status should be removed
  deltas = forwardDeltaResults(
    (game) => forwardStripSawedStatus(player, game),
    deltas,
  );

  // If shooting self and blank, its still their turn. Otherwise, it's the
  // next player's turn.
  if (action.who !== player || bullet !== 'blank') {
    deltas = forwardDeltaResults(forwardNextTurn, deltas);
  }

  return deltas;
}

function handleUseItem(
  player: PlayerId,
  game: Game,
  action: Extract<Action, { type: 'useItem' }>,
): Result<GameDeltas, string> {
  const playerState: Maybe<PlayerState> = maybeFind(
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
  return R.flow(Result.ok([{ game, delta: { type: 'noop' } }]), [
    // remove item
    forwardDeltaResults(
      applyDelta(R.__, {
        type: 'itemChanges',
        itemChanges: [
          { playerId: player, item: Item.nothing, slot: action.which },
        ],
      }),
    ),
    // apply the item
    forwardDeltaResults(handleApplyItem(player, R.__, action)),
  ]);
}

/** Assume the item has been validated to exist */
const handleApplyItem = R.curryN(
  3,
  function (
    player: PlayerId,
    game: Game,
    action: Extract<Action, { type: 'useItem' }>,
  ): Result<GameDeltas, string> {
    const delta = matchlike(action)('item')({
      [Item.pop]: (action) => forwardApplyPop(player, game, action),
      [Item.magnifyingGlass]: (action) =>
        forwardApplyMagnifyingGlass(player, game, action),
      [Item.apple]: (action) => forwardApplyApple(player, game, action),
      [Item.handcuff]: (action) => forwardApplyHandcuff(player, game, action),
      [Item.handsaw]: (action) => forwardApplyHandsaw(player, game, action),
      [Item.inverter]: (action) => forwardApplyInverter(player, game, action),
      [Item.hotPotato]: (action) => forwardApplyHotPotato(player, game, action),
    });

    return delta;
  },
);

export function handleAction(
  action: Action,
  player: PlayerId,
  game: Game,
): Result<GameDeltas, string> {
  const availableActions = getAvailableActions(player, game);

  if (!availableActions.includes(action.type)) {
    return Result.err('This action is not available to you.');
  } else {
    return matchlike(action)('type')({
      shoot: (x) => handleShoot(player, game, x),
      pass: () => forwardNextTurn(game),
      useItem: (x) => handleUseItem(player, game, x),
    });
  }
}

function maybeReboundActionLoop(game: Game): Result<GameDeltas, string> {
  const player = game.playerStates.find((p) => p.turn === game.turn)?.id;
  if (!player) return Result.err('Programmer messed up');
  const availableActions = getAvailableActions(player, game);
  const done = doneGame(game);

  if (
    availableActions.length === 1 &&
    availableActions[0] === ActionType.pass &&
    !done
  ) {
    return handleActionLoop({ type: ActionType.pass }, player, game);
  } else {
    return Result.ok([{ game, delta: { type: 'noop' } }]);
  }
}

export function handleActionLoop(
  action: Action,
  player: PlayerId,
  game: Game,
): Result<GameDeltas, string> {
  return forwardDeltaResults(
    maybeReboundActionLoop,
    handleAction(action, player, game),
  );
}
