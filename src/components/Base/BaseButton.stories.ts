import type { Meta, StoryObj } from "@storybook/vue3";

import BaseButton from "./BaseButton.vue";

const meta: Meta<typeof BaseButton> = {
  component: BaseButton,
};

export default meta;
type Story = StoryObj<typeof BaseButton>;

export const Default: Story = {
  args: {
    label: "Default",
    variant: "default",
    icon: "settings",
  },
};

export const Primary: Story = {
  args: {
    label: "Primary",
    variant: "primary",
    icon: "settings",
  },
};

export const Danger: Story = {
  args: {
    label: "Danger",
    variant: "danger",
    icon: "settings",
  },
};
