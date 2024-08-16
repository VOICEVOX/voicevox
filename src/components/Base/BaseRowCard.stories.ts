import type { Meta, StoryObj } from "@storybook/vue3";

import BaseRowCard from "./BaseRowCard.vue";

import BaseButton from "./BaseButton.vue";

const meta: Meta<typeof BaseRowCard> = {
  component: BaseRowCard,
};

export default meta;
type Story = StoryObj<typeof BaseRowCard>;

export const Default: Story = {
  render: (args) => ({
    components: { BaseRowCard, BaseButton },
    setup() {
      return { args };
    },
    template:
      '<BaseRowCard v-bind="args"><BaseButton label="RightControl" /></BaseRowCard>',
  }),
  args: {
    title: "Title",
    description: "Description",
  },
};
