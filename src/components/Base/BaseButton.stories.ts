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

  render: (args) => ({
    components: { BaseButton },

    setup() {
      return { args };
    },

    template: '<BaseButton v-bind="args" />',
  }),
};

export const Primary: Story = {
  args: {
    label: "Primary",
    variant: "primary",
    icon: "settings",
  },

  render: (args) => ({
    components: {
      BaseButton,
    },

    setup() {
      return { args };
    },

    template: '<BaseButton v-bind="args" />',
  }),
};

export const Danger: Story = {
  args: {
    label: "Danger",
    variant: "danger",
    icon: "settings",
  },

  render: (args) => ({
    components: {
      BaseButton,
    },

    setup() {
      return { args };
    },

    template: '<BaseButton v-bind="args" />',
  }),
};
