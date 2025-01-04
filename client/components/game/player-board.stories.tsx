import { cycleList } from "@/lib/utils";
import PlayerBoard from "./player-board";
import { Meta, StoryObj } from "@storybook/react";
import { Item, Status, StatusType } from "@shared/game/types";

type PlayerBoardProps = React.ComponentProps<typeof PlayerBoard>;
type Story = StoryObj<PlayerBoardProps>;

const meta = {
  component: PlayerBoard,
  title: "components/PlayerBoard",
  parameters: {
    actions: { argTypesRegex: "^on.*" },
  },
  decorators: [],
} satisfies Meta<PlayerBoardProps>;
export default meta;

const statuses: Status[] = [
  { index: "whatever0", type: StatusType.handcuffed, turns: 1 },
  { index: "whatever1", type: StatusType.slipperyHands, turns: 1 },
  { index: "whatever2", type: StatusType.handcuffed, turns: 1 },
  { index: "whatever3", type: StatusType.slipperyHands, turns: 1 },
];

const me = {
  id: "foo",
  items: cycleList(Object.values(Item)).take(8),
  health: 10,
  turn: 0,
  statuses,
};

const other = {
  id: "bar",
  items: cycleList(Object.values(Item)).take(8),
  health: 10,
  turn: 1,
  statuses: [],
};

export const Default = {
  args: { me, other, interactable: true, targeted: false },
} satisfies Story;

export const Targeted = {
  args: { me, other, interactable: true, targeted: true },
} satisfies Story;

export const Thinking = {
  args: { me, other, interactable: true, thinking: true },
} satisfies Story;
