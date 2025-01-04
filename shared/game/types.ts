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
}
export enum ActionType {
  shoot = "shoot",
  pass = "pass",
  useItem = "useItem",
}
export enum StatusType {
  handcuffed = "handcuffed",
  slipperyHands = "slipperyHands",
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
    item: z.enum([Item.pop, Item.magnifyingGlass, Item.apple]),
  }),
  z.object({
    type: z.enum([ActionType.useItem]),
    which: z.number().int(),
    item: z.enum([Item.handcuff]),
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
  | { type: "shoot"; who: PlayerId; hurt: number; bullet: Bullet }
  | { type: "inspect"; bullet: Bullet }
  | { type: "pop"; bullet: Bullet }
  | { type: "nomnom"; who: PlayerId; heal: number }
  | { type: "statusChanges"; statusChanges: PlayerStatusChange[] }
  | { type: "itemChanges"; itemChanges: PlayerItemChange[] }
  | { type: "reload"; lives: number; blanks: number }
  | { type: "gg" };

export type Status = {
  index: StatusIndex;
  turns: number;
} & ({ type: StatusType.handcuffed } | { type: StatusType.slipperyHands });

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
};

export type Lobby = {
  id: LobbyId;
  spectators: PlayerId[];
  players: PlayerId[];
} & (
  | {
      state: "active";
      game: Game;
    }
  | { state: "waiting" }
);
export type GameLobby = Extract<Lobby, { state: "active" }>;
export type PublicGame = Omit<Game, "gun">;
export type Waiting = Extract<Lobby, { state: "waiting" }>;

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
