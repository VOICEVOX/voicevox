import type { Meta, StoryObj } from "@storybook/vue3";

import BaseScrollArea from "./BaseScrollArea.vue";

const meta: Meta<typeof BaseScrollArea> = {
  component: BaseScrollArea,
};

export default meta;
type Story = StoryObj<typeof BaseScrollArea>;

export const Default: Story = {
  render: (args) => ({
    components: { BaseScrollArea },
    setup() {
      return { args };
    },
    template:
      '<BaseScrollArea style="width: 100%; height:480px" v-bind="args"><div style="width: 100%; height:4800px;"></div></BaseScrollArea>',
  }),
};
