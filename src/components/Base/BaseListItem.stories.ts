import type { Meta, StoryObj } from "@storybook/vue3";

import BaseListItem from "./BaseListItem.vue";

const meta: Meta<typeof BaseListItem> = {
  component: BaseListItem,
};

export default meta;
type Story = StoryObj<typeof BaseListItem>;

export const Default: Story = {
  render: (args) => ({
    components: { BaseListItem },
    setup() {
      return { args };
    },
    template: '<BaseListItem v-bind="args">ListItem</BaseListItem>',
  }),
  args: {
    selected: false,
  },
};

export const Selected: Story = {
  args: {
    selected: true,
  },

  render: (args) => ({
    components: {
      BaseListItem,
    },

    setup() {
      return { args };
    },

    template: '<BaseListItem v-bind="args">ListItem</BaseListItem>',
  }),
};
