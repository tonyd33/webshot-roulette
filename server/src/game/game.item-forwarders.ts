import {
  Action,
  Game,
  GameDeltas,
  Item,
  PlayerId,
  PlayerState,
  Status,
  StatusType,
} from '@shared/game/types';
import { firstRest, guardResultAndThen } from '@shared/true-myth/addons';
import Result from '@shared/true-myth/result';
import {
  findPlayer,
  generateStatusIndex,
  playerIdEq,
  replaceInArray,
} from './game.utils';
import { ensureUnreachable } from '@shared/typescript';

type UseItemAction = Extract<Action, { type: 'useItem' }>;

export function forwardApplyPop(
  player: PlayerId,
  game: Game,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  action: Extract<UseItemAction, { item: Item.pop }>,
): Result<GameDeltas, string> {
  return firstRest(game.gun).map(([first, rest]) => [
    {
      game: { ...game, gun: rest },
      delta: { type: 'pop', bullet: first },
    },
  ]);
}

export function forwardApplyMagnifyingGlass(
  player: PlayerId,
  game: Game,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  action: Extract<UseItemAction, { item: Item.magnifyingGlass }>,
): Result<GameDeltas, string> {
  return firstRest(game.gun).map(([first, rest]) => [
    {
      game: { ...game, gun: [first, ...rest] },
      delta: { type: 'inspect', bullet: first },
    },
  ]);
}

export function forwardApplyApple(
  player: PlayerId,
  game: Game,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  action: Extract<UseItemAction, { item: Item.apple }>,
): Result<GameDeltas, string> {
  return findPlayer(player, game)
    .andThen((p) =>
      p.health >= 10 ? Result.err("You're too full") : Result.ok(p),
    )
    .map(() => [
      {
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
      },
    ]);
}

export function forwardApplyHandcuff(
  player: PlayerId,
  game: Game,
  action: Extract<UseItemAction, { item: Item.handcuff }>,
): Result<GameDeltas, string> {
  const notHandcuffed = (p: PlayerState) =>
    p.statuses.every((s) => s.type !== StatusType.handcuffed);
  const notSlippery = (p: PlayerState) =>
    p.statuses.every((s) => s.type !== StatusType.slipperyHands);

  return findPlayer(action.who, game)
    .andThen(guardResultAndThen(notHandcuffed, 'Already handcuffed'))
    .andThen(
      guardResultAndThen(
        notSlippery,
        "Dude has slippery hands, can't cuff 'em",
      ),
    )
    .map((p) => {
      const status: Status = {
        index: generateStatusIndex(),
        type: StatusType.handcuffed,
        turns: 1,
      };
      return [
        {
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
        },
      ];
    });
}

export function forwardApplyHandsaw(
  player: PlayerId,
  game: Game,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  action: Extract<UseItemAction, { item: Item.handsaw }>,
): Result<GameDeltas, string> {
  return findPlayer(player, game)
    .andThen(
      guardResultAndThen(
        (x) =>
          x.statuses.filter((s) => s.type === StatusType.sawed).length <
          game.settings.handsawStackLimit,
        'Handsaw limit reached',
      ),
    )
    .map((p) => {
      const status: Status = {
        index: generateStatusIndex(),
        type: StatusType.sawed,
        turns: null,
      };
      return [
        {
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
        },
      ];
    });
}

export function forwardApplyInverter(
  player: PlayerId,
  game: Game,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  action: Extract<UseItemAction, { item: Item.handsaw }>,
): Result<GameDeltas, string> {
  return Result.ok([
    {
      game: {
        ...game,
        gun: game.gun.map((bullet) => {
          switch (bullet) {
            case 'live':
              return 'blank';
            case 'blank':
              return 'live';
            default:
              ensureUnreachable(bullet);
          }
        }),
      },
      delta: { type: 'inverted' },
    },
  ]);
}

export function forwardApplyHotPotato(
  player: PlayerId,
  game: Game,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  action: Extract<UseItemAction, { item: Item.hotPotato }>,
): Result<GameDeltas, string> {
  return findPlayer(action.who, game).map((p) => {
    const status: Status = {
      index: generateStatusIndex(),
      type: StatusType.hotPotatoReceiver,
      turns: 0,
    };
    return [
      {
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
      },
    ];
  });
}
