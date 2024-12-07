import type { Meta, StoryObj } from "@storybook/vue3";

import { TooltipProvider } from "radix-vue";
import BaseIconButton from "./BaseIconButton.vue";

const meta: Meta<typeof BaseIconButton> = {
  component: BaseIconButton,
  render: (args) => ({
    components: { BaseIconButton, TooltipProvider },
    setup() {
      return { args };
    },
    template: `
    <TooltipProvider>
      <BaseIconButton v-bind="args" />
    </TooltipProvider>`,
  }),
};

export default meta;
type Story = StoryObj<typeof BaseIconButton>;

export const Default: Story = {
  args: {
    label: "Default",
    icon: "settings",
  },
};

export const Disabled: Story = {
  args: {
    label: "Disabled",
    icon: "settings",
    disabled: true,
  },
};
