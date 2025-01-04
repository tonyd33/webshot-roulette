import * as R from "ramda";
import Healthbar from "./healthbar";
import { Meta, StoryObj } from "@storybook/react";

type HealthbarProps = React.ComponentProps<typeof Healthbar>;
type Story = StoryObj<HealthbarProps>;

const meta = {
  component: Healthbar,
  title: "components/Healthbar",
  parameters: { actions: { argTypesRegex: "^on.*" } },
  decorators: [],
} satisfies Meta<HealthbarProps>;
export default meta;

const denominator = 29;

export const Default = {
  render: () => (
    <div className="flex flex-row flex-wrap space-x-4">
      {R.range(-1, denominator + 1).map((i) => (
        <Healthbar key={i} health={i} maxHealth={denominator} />
      ))}
    </div>
  ),
  args: {},
} satisfies Story;
