import { z } from 'zod';

export enum Item {
  pop = 'pop',
  magnifyingGlass = 'magnifyingGlass',
  apple = 'apple',
  nothing = 'nothing',
}

export const PlayerIdSchema = z.string();
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('shoot'),
    who: PlayerIdSchema,
  }),
  z.object({
    type: z.literal('useItem'),
    which: z.number().int(),
  }),
  z.object({
    type: z.literal('pass'),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;
export type PlayerId = z.infer<typeof PlayerIdSchema>;

export type Bullet = 'live' | 'blank';

export type ActionEffect =
  | {
      type: 'shoot';
      who: PlayerId;
      hurt: number;
      bullet: Bullet;
    }
  | { type: 'inspect'; bullet: Bullet }
  | { type: 'pop'; bullet: Bullet }
  | { type: 'pass'; turn: number }
  | { type: 'nomnom'; who: PlayerId; heal: number }
  | { type: 'gg' }
  | { type: 'reload'; lives: number; blanks: number };

export type Status = {
  type: 'handcuffed';
  forTurns: number;
};

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

export type Lobby = { id: LobbyId } & (
  | {
      state: 'active';
      game: Game;
    }
  | { state: 'waiting'; activePlayers: PlayerId[] }
);
export type GameLobby = Extract<Lobby, { state: 'active' }>;
export type PublicGame = Omit<Game, 'gun'>;
export type Waiting = Extract<Lobby, { state: 'waiting' }>;

export type GameDelta = {
  game: Game;
  effects: ActionEffect[];
};
export type PublicDelta = {
  game: PublicGame;
  effects: ActionEffect[];
};

export type LobbyId = string;
