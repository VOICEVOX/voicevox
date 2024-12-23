import type { Meta, StoryObj } from "@storybook/vue3";

import { ref } from "vue";
import BaseSlider from "./BaseSlider.vue";

const meta: Meta<typeof BaseSlider> = {
  component: BaseSlider,
  args: {
    modelValue: 50,
    min: 0,
    max: 100,
    step: 1,
  },
  render: (args) => ({
    components: { BaseSlider },
    setup() {
      const model = ref(Number(args.modelValue));
      return { args, model };
    },
    template: `<BaseSlider v-bind="args" v-model="model"></BaseSlider>`,
  }),
};

export default meta;
type Story = StoryObj<typeof BaseSlider>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
