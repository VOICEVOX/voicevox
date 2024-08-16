import type { Meta, StoryObj } from "@storybook/vue3";

import BaseSwitch from "./BaseSwitch.vue";

const meta: Meta<typeof BaseSwitch> = {
  component: BaseSwitch,
};

export default meta;
type Story = StoryObj<typeof BaseSwitch>;

export const Unchecked: Story = {
  args: {
    uncheckedLabel: "Off",
    checkedLabel: "On",
    checked: false,
  },

  render: (args) => ({
    components: { BaseSwitch },

    setup() {
      return { args };
    },

    template: '<BaseSwitch v-bind="args" />',
  }),
};

export const Checked: Story = {
  args: {
    uncheckedLabel: "Off",
    checkedLabel: "On",
    checked: true,
  },

  render: (args) => ({
    components: {
      BaseSwitch,
    },

    setup() {
      return { args };
    },

    template: '<BaseSwitch v-bind="args" />',
  }),
};
