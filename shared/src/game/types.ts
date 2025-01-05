import { z } from "zod";

export enum ClientEvent {
  create = "create",
  chat = "chat",
  act = "act",
  join = "join",
  start = "start",
  poll = "poll",
  whoami = "whoami",
  changeActivity = "changeActivity",
  changeSettings = "changeSettings",

  disconnect = "disconnect",
  connect = "connect",
}

export enum ServerEvent {
  delta = "delta",
  syncLobby = "syncLobby",
  chat = "chat",
  error = "error",
  whoyouare = "whoyouare",
  start = "start",

  connect = "connect",
}

export enum Item {
  pop = "pop",
  magnifyingGlass = "magnifyingGlass",
  apple = "apple",
  handcuff = "handcuff",
  nothing = "nothing",
  handsaw = "handsaw",
  inverter = "inverter",
  hotPotato = "hotPotato",
}
export enum ActionType {
  shoot = "shoot",
  pass = "pass",
  useItem = "useItem",
}
export enum StatusType {
  handcuffed = "handcuffed",
  sawed = "sawed",
  slipperyHands = "slipperyHands",
  hotPotatoReceiver = "hotPotatoReceiver",
}

export enum HandsawDamageStackBehavior {
  multiply = "multiply",
  add = "add",
}

export const PlayerIdSchema = z.string();

/**
 * The reason we use a union here is because we might want to support items
 * using additional metadata in the future, like handcuffs to allow choosing
 * someone else, in case we support more than two players.
 */
const UseItemSchema = z.union([
  z.object({
    type: z.enum([ActionType.useItem]),
    which: z.number().int(),
    item: z.enum([
      Item.pop,
      Item.magnifyingGlass,
      Item.apple,
      Item.handsaw,
      Item.inverter,
    ]),
  }),
  z.object({
    type: z.enum([ActionType.useItem]),
    which: z.number().int(),
    item: z.literal(Item.handcuff),
    who: PlayerIdSchema,
  }),
  z.object({
    type: z.enum([ActionType.useItem]),
    which: z.number().int(),
    item: z.literal(Item.hotPotato),
    who: PlayerIdSchema,
  }),
]);

export const ActionSchema = z.union([
  z.object({
    type: z.enum([ActionType.shoot]),
    who: PlayerIdSchema,
  }),
  UseItemSchema,
  z.object({
    type: z.enum([ActionType.pass]),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;
export type PlayerId = z.infer<typeof PlayerIdSchema>;
export type StatusIndex = string;

export type Bullet = "live" | "blank";
export type PlayerItemChange = { playerId: PlayerId; slot: number; item: Item };
export type PlayerStatusChange = { playerId: PlayerId } & (
  | { type: "upsert"; status: Status }
  | { type: "rm"; index: StatusIndex }
);

export type Delta =
  /** Special delta used internally */
  | { type: "noop" }
  /** Next turn */
  | { type: "pass" }
  | { type: "hurt"; who: PlayerId; dmg: number }
  | { type: "shoot"; who: PlayerId; hurt: number; bullet: Bullet }
  | { type: "inspect"; bullet: Bullet }
  | { type: "pop"; bullet: Bullet }
  | { type: "nomnom"; who: PlayerId; heal: number }
  | { type: "statusChanges"; statusChanges: PlayerStatusChange[] }
  | { type: "itemChanges"; itemChanges: PlayerItemChange[] }
  | { type: "inverted" }
  | { type: "reload"; lives: number; blanks: number }
  | { type: "gg"; winner: PlayerId };

export type Status =
  | {
      index: StatusIndex;
      /** null = Number.POSITIVE_INFINITY */
      turns: number | null;
    } & (
      | { type: StatusType.hotPotatoReceiver }
      | { type: StatusType.handcuffed }
      | { type: StatusType.slipperyHands }
      | { type: StatusType.sawed }
    );

export type PlayerState = {
  id: PlayerId;
  items: Item[];
  health: number;
  /** turn order */
  turn: number;
  statuses: Status[];
};

export type Game = {
  gun: Bullet[];
  playerStates: PlayerState[];
  turn: number;
  maxPlayerItems: number;
  settings: GameSettings;
};
export type PublicGame = Omit<Game, "gun">;

export const GameSettingsSchema = z.object({
  handsawStackLimit: z.number().int().gte(1),
  handsawDamageStackBehavior: z.nativeEnum(HandsawDamageStackBehavior),
  handcuffCooldownTurns: z.number().int().gte(0),
  itemDistribution: z.nativeEnum(Item).array(),
  players: z.literal(2),
});

export type GameSettings = z.infer<typeof GameSettingsSchema>;

type BaseLobby = {
  id: LobbyId;
  spectators: PlayerId[];
  players: PlayerId[];
  creator: PlayerId;
};

export type GameLobby = BaseLobby & {
  state: "active";
  game: Game;
};
export type PublicGameLobby = Omit<GameLobby, "game"> & {
  game: PublicGame;
};
export type WaitingLobby = BaseLobby & {
  state: "waiting";
  settings: GameSettings;
};
export type PublicWaitingLobby = WaitingLobby;

export type Lobby = GameLobby | WaitingLobby;
export type PublicLobby = (PublicGameLobby | PublicWaitingLobby) & {
  mark: "public";
};

export type GameDeltas = GameDelta[];
export type GameDelta = {
  /** The game after the effect completes */
  game: Game;
  delta: Delta;
};
export type PublicGameDelta = {
  game: PublicGame;
  delta: Delta;
};

export type LobbyId = string;
