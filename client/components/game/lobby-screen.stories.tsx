import { Waiting } from "@shared/game/types";
import LobbyScreen from "./lobby-screen";
import { Meta, StoryObj } from "@storybook/react";

type LobbyScreenProps = React.ComponentProps<typeof LobbyScreen>;
type Story = StoryObj<LobbyScreenProps>;

const meta = {
  component: LobbyScreen,
  title: "components/LobbyScreen",
  parameters: {
    actions: { argTypesRegex: "^on.*" },
  },
  decorators: [],
} satisfies Meta<LobbyScreenProps>;
export default meta;

const waiting: Waiting = {
  id: "abcd",
  state: "waiting",
  players: ["previous-scarlet-lizard", "mad-magenta-leech"],
  spectators: ["burly-yellow-groundhog", "rambunctious-cyan-tortoise"],
  creator: "burly-yellow-groundhog",
};

export const Default = {
  args: {
    lobby: waiting,
    me: "previous-scarlet-lizard",
  },
} satisfies Story;

// Add more stories here
