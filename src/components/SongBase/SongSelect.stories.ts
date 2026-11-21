import { ref } from "vue";
import type { Meta, StoryObj } from "@storybook/vue3-vite";

import SongSelect from "./SongSelect.vue";
import SongSelectItem from "./SongSelectItem.vue";

const meta: Meta<typeof SongSelect> = {
  component: SongSelect as Record<keyof typeof SongSelect, unknown>,
  render: (args) => ({
    components: { SongSelect, SongSelectItem },
    setup() {
      const modelValue = ref(16);
      return { args, modelValue };
    },
    template: `
      <SongSelect v-bind="args" v-model="modelValue">
        <SongSelectItem v-for="n in [4, 8, 16, 32]" :key="n" :label="\`1/\${n}\`" :value="n" />
      </SongSelect>`,
  }),
};

export default meta;
type Story = StoryObj<typeof SongSelect>;

export const Default: Story = {
  args: {},
};

export const WithLabel: Story = {
  args: {
    label: "スナップ",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
