import { Status } from "@shared/game/types";
import StatusCarousel from "./status-carousel";
import { Meta, StoryObj } from "@storybook/react";
import _ from "lodash";

type StatusCarouselProps = React.ComponentProps<typeof StatusCarousel>;
type Story = StoryObj<StatusCarouselProps>;

const meta = {
  component: StatusCarousel,
  title: "components/StatusCarousel",
  parameters: { actions: { argTypesRegex: "^on.*" } },
  decorators: [],
} satisfies Meta<StatusCarouselProps>;
export default meta;

const statuses: Status[] = _.range(10).map((i) => ({
  index: `whatever${i}`,
  type: "handcuffed",
  turns: i,
}));

export const Default = {
  args: { statuses },
} satisfies Story;

export const Empty = {
  args: { statuses: [] },
} satisfies Story;
