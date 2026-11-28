import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { TooltipProvider } from "reka-ui";
import Presentation from "./Presentation.vue";

const meta: Meta<typeof Presentation> = {
  component: Presentation,
  args: {
    editTarget: "VOLUME",
    volumeTool: "DRAW",
    phonemeTimingTool: "MOVE",
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

export const Volume: Story = {
  name: "ボリューム",
  args: {
    editTarget: "VOLUME",
  },
};

export const PhonemeTiming: Story = {
  name: "音素タイミング",
  args: {
    editTarget: "PHONEME_TIMING",
  },
};
