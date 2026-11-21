import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { TooltipProvider } from "reka-ui";
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
    components: { SongSlider, TooltipProvider },
    setup() {
      const model = ref(Number(args.modelValue));
      return { args, model };
    },
    template: `
      <TooltipProvider>
        <div style="width: 120px">
          <SongSlider v-bind="args" v-model="model" />
        </div>
      </TooltipProvider>`,
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

/** ドラッグ中だけ、つまみの上に値を表示する */
export const WithValue: Story = {
  args: {
    formatValue: (value: number) => String(value),
  },
};
