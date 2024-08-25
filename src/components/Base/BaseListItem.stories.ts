import type { Meta, StoryObj } from "@storybook/vue3";

import BaseListItem from "./BaseListItem.vue";

const meta: Meta<typeof BaseListItem> = {
  component: BaseListItem,
};

export default meta;
type Story = StoryObj<typeof BaseListItem>;

export const Default: Story = {
  args: {
    selected: false,
  },
  render: (args) => ({
    components: { BaseListItem },
    setup() {
      return { args };
    },
    template: '<BaseListItem v-bind="args">ListItem</BaseListItem>',
  }),
};

export const Selected: Story = {
  ...Default,
  args: {
    selected: true,
  },
};
