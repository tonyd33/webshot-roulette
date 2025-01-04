import { useHighlight } from "./use-highlight";
import { Meta, StoryObj } from "@storybook/react";

const UseHighlight = () => {
  const { highlight, clear: clearHighlight } = useHighlight();

  return (
    <div>
      <button onClick={() => highlight("highlight-me")}>
        Highlight Element
      </button>

      <div
        id="highlight-me"
        className="m-4 p-4 border rounded w-32 text-center flex flex-col"
      >
        Highlight this element

        <button onClick={clearHighlight}>Clear highlight</button>
      </div>
    </div>
  );
};

type UseHighlightProps = React.ComponentProps<typeof UseHighlight>;
type Story = StoryObj<UseHighlightProps>;

const meta = {
  component: UseHighlight,
  title: "hooks/UseHighlight",
  parameters: {
    actions: { argTypesRegex: "^on.*" },
  },
  decorators: [],
} satisfies Meta<UseHighlightProps>;
export default meta;

export const Default = {
  args: {},
} satisfies Story;

// Add more stories here
