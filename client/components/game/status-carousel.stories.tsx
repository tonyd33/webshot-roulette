import { Status, StatusType } from "@shared/game/types";
import StatusCarousel from "./status-carousel";
import { Meta, StoryObj } from "@storybook/react";
import _ from "lodash";
import { cycleList } from "@/lib/utils";

type StatusCarouselProps = React.ComponentProps<typeof StatusCarousel>;
type Story = StoryObj<StatusCarouselProps>;

const meta = {
  component: StatusCarousel,
  title: "components/StatusCarousel",
  parameters: { actions: { argTypesRegex: "^on.*" } },
  decorators: [],
} satisfies Meta<StatusCarouselProps>;
export default meta;

const statuses: Status[] = cycleList(Object.values(StatusType))
  .take(8)
  .map((status, i) => ({
    index: `whatever${status}_${i}`,
    type: status,
    turns: i,
  }));

export const Default = {
  args: { statuses },
} satisfies Story;

export const Empty = {
  args: { statuses: [] },
} satisfies Story;
