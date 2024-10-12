import type { Meta, StoryObj } from "@storybook/vue3";

import BaseCheckbox from "./BaseCheckbox.vue";

const meta: Meta<typeof BaseCheckbox> = {
  component: BaseCheckbox,
};

export default meta;
type Story = StoryObj<typeof BaseCheckbox>;

export const Default: Story = {
  args: {
    label: "Default",
    checked: false,
  },
};

export const Checked: Story = {
  ...Default,
  args: {
    label: "Checked",
    checked: true,
  },
};
