import Result from '@shared/true-myth/result';
import {
  Action,
  ActionType,
  Delta,
  Game,
  GameDeltas,
  Item,
  PlayerId,
  PlayerState,
  StatusType,
} from '@shared/game/types';
import { popItem } from '@shared/true-myth/addons';
import Maybe, { find as maybeFind } from '@shared/true-myth/maybe';
import { matchlike } from '@shared/typescript';
import {
  findPlayer,
  forwardDeltaResults,
  replacePlayerItemDelta,
} from './game.utils';
import { forwardNextTurn, forwardStripSawedStatus } from './game.forwarders';
import {
  forwardApplyApple,
  forwardApplyHandcuff,
  forwardApplyHandsaw,
  forwardApplyMagnifyingGlass,
  forwardApplyPop,
} from './game.item-forwarders';

function handleShoot(
  player: PlayerId,
  game: Game,
  action: Extract<Action, { type: 'shoot' }>,
): Result<GameDeltas, string> {
  const [bullet, ...rest] = game.gun;
  const multiplier = findPlayer(player, game)
    .map((p) =>
      // Yes, this may allow a player to deal ridiculous damage on one turn
      // because there are no countermeasures to stacking handsaws.
      // Is it fair? No.
      // Is it funny? Hell yeah.
      p.statuses.reduce(
        (acc, s) => (s.type === StatusType.sawed ? 2 : 1) * acc,
        1,
      ),
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
) {
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
  const delta = matchlike(action)('item')({
    [Item.pop]: (action) => forwardApplyPop(player, game, action),
    [Item.magnifyingGlass]: (action) =>
      forwardApplyMagnifyingGlass(player, game, action),
    [Item.apple]: (action) => forwardApplyApple(player, game, action),
    [Item.handcuff]: (action) => forwardApplyHandcuff(player, game, action),
    [Item.handsaw]: (action) => forwardApplyHandsaw(player, game, action),
  });

  return delta;
}

export function handleAction(
  action: Action,
  player: PlayerId,
  game: Game,
): Result<GameDeltas, string> {
  const availableActions: Result<ActionType[], string> = maybeFind(
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
        pass: () => forwardNextTurn(game),
        useItem: (x) => handleUseItem(player, game, x),
      }),
    );
}
