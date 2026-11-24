import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { TooltipProvider } from "reka-ui";
import Presentation from "./Presentation.vue";
import { DEFAULT_TPQN, getSnapTypes } from "@/song/domain";

const meta: Meta<typeof Presentation> = {
  component: Presentation,
  args: {
    editTarget: "NOTE",
    noteTool: "EDIT_FIRST",
    pitchTool: "DRAW",
    snapType: 16,
    snapTypes: getSnapTypes(DEFAULT_TPQN),
  },
  decorators: [
    () => ({
      components: { TooltipProvider },
      template: `<TooltipProvider><div style="width: 800px"><story /></div></TooltipProvider>`,
    }),
  ],
} satisfies Meta<typeof Presentation>;

export default meta;
type Story = StoryObj<typeof Presentation>;

export const Note: Story = {
  name: "ノート",
  args: {
    editTarget: "NOTE",
  },
};

export const Pitch: Story = {
  name: "ピッチ",
  args: {
    editTarget: "PITCH",
  },
};
