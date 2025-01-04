import { Item, Status } from "@shared/game/types";
import GameLayout from "./game-layout";
import { Meta, StoryObj } from "@storybook/react";
import { cycleList } from "@/lib/utils";

type GameLayoutProps = React.ComponentProps<typeof GameLayout>;
type Story = StoryObj<GameLayoutProps>;

const meta = {
  component: GameLayout,
  title: "components/GameLayout",
  parameters: {
    actions: { argTypesRegex: "^on.*" },
  },
  decorators: [],
} satisfies Meta<GameLayoutProps>;
export default meta;

const statuses: Status[] = [
  { index: "whatever0", type: "handcuffed", turns: 1 },
  { index: "whatever1", type: "handcuffed", turns: 1 },
  { index: "whatever2", type: "handcuffed", turns: 1 },
  { index: "whatever3", type: "handcuffed", turns: 1 },
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
  args: {
    me,
    other,
    interactable: true,
    isMyTurn: true,
  },
} satisfies Story;

export const OtherTurn = {
  args: {
    me,
    other,
    interactable: false,
    isMyTurn: false,
  },
} satisfies Story;

export const Reload = {
  args: {
    me,
    other,
    interactable: false,
    isMyTurn: false,
    ephemeral: {
      bullets: { live: 2, blank: 4 },
    },
  },
} satisfies Story;

export const Targeting = {
  args: {
    me,
    other,
    interactable: false,
    isMyTurn: false,
    ephemeral: { targeting: [me.id, other.id] },
  },
} satisfies Story;
