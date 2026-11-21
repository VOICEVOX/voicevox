import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { TooltipProvider } from "reka-ui";
import { ref } from "vue";
import SongNumberInput from "./SongNumberInput.vue";

const meta: Meta<typeof SongNumberInput> = {
  component: SongNumberInput,
  args: {
    label: "テンポ",
    modelValue: 120,
    min: 20,
    max: 400,
  },
  render: (args) => ({
    components: { SongNumberInput, TooltipProvider },
    setup() {
      const model = ref(Number(args.modelValue));
      return { args, model };
    },
    template: `
      <TooltipProvider>
        <SongNumberInput v-bind="args" v-model="model" />
      </TooltipProvider>`,
  }),
};

export default meta;
type Story = StoryObj<typeof SongNumberInput>;

export const Default: Story = {};

export const Flat: Story = {
  args: {
    variant: "flat",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
