import { ref } from "vue";
import type { Meta, StoryObj } from "@storybook/vue3-vite";

import SongToggleGroup from "./SongToggleGroup.vue";
import SongToggleGroupItem from "./SongToggleGroupItem.vue";

const meta: Meta<typeof SongToggleGroup> = {
  component: SongToggleGroup as Record<keyof typeof SongToggleGroup, unknown>,
  render: (args) => ({
    components: { SongToggleGroup, SongToggleGroupItem },
    setup() {
      const modelValue = ref(args.type === "multiple" ? ["volume"] : "volume");
      return { args, modelValue };
    },
    template: `
      <SongToggleGroup v-bind="args" v-model="modelValue">
        <SongToggleGroupItem label="ボリューム" value="volume" />
        <SongToggleGroupItem label="音素タイミング" value="phonemeTiming" />
      </SongToggleGroup>`,
  }),
};

export default meta;
type Story = StoryObj<typeof SongToggleGroup>;

export const Single: Story = {
  args: {
    type: "single",
  },
};

export const OptionalSingle: Story = {
  args: {
    type: "optionalSingle",
  },
};

export const Multiple: Story = {
  args: {
    type: "multiple",
  },
};

export const Disabled: Story = {
  args: {
    type: "single",
    disabled: true,
  },
};
