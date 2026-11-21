import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { TooltipProvider } from "reka-ui";
import SongTooltip from "./SongTooltip.vue";

const meta: Meta<typeof SongTooltip> = {
  component: SongTooltip,
  render: (args) => ({
    components: { SongTooltip, TooltipProvider },
    setup() {
      return { args };
    },
    template: `
    <TooltipProvider>
      <SongTooltip v-bind="args">
        <span>Hover</span>
      </SongTooltip>
    </TooltipProvider>`,
  }),
};

export default meta;
type Story = StoryObj<typeof SongTooltip>;

export const Default: Story = {
  args: {
    label: "Default",
  },
};

export const Disabled: Story = {
  args: {
    label: "Default",
    disabled: true,
  },
};
