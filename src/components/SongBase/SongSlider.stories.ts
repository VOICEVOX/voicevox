import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { ref } from "vue";
import SongSlider from "./SongSlider.vue";

const meta: Meta<typeof SongSlider> = {
  component: SongSlider,
  args: {
    label: "音量",
    modelValue: 80,
    min: 0,
    max: 100,
    step: 1,
  },
  render: (args) => ({
    components: { SongSlider },
    setup() {
      const model = ref(Number(args.modelValue));
      return { args, model };
    },
    template: `
      <div style="width: 120px">
        <SongSlider v-bind="args" v-model="model" />
      </div>`,
  }),
};

export default meta;
type Story = StoryObj<typeof SongSlider>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
