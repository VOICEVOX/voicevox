import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { TooltipProvider } from "reka-ui";
import BaseTooltip from "./BaseTooltip.vue";

const meta: Meta<typeof BaseTooltip> = {
  component: BaseTooltip,
  render: (args) => ({
    components: { BaseTooltip, TooltipProvider },
    setup() {
      return { args };
    },
    template: `
    <TooltipProvider>
      <BaseTooltip v-bind="args">
        <span>Hover</span>
      </BaseTooltip>
    </TooltipProvider>`,
  }),
};

export default meta;
type Story = StoryObj<typeof BaseTooltip>;

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
