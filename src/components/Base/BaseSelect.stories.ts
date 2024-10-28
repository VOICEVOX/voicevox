import { ref } from "vue";
import type { Meta, StoryObj } from "@storybook/vue3";

import BaseSelect from "./BaseSelect.vue";
import BaseSelectItem from "./BaseSelectItem.vue";

const meta: Meta<typeof BaseSelect> = {
  component: BaseSelect,
  render: (args) => ({
    components: { BaseSelect, BaseSelectItem },
    setup() {
      const modelValue = ref(
        args.modelValue ? String(args.modelValue) : undefined,
      );
      return { args, modelValue };
    },
    template: `
      <BaseSelect v-bind="args" v-model="modelValue">
        <BaseSelectItem label="A" value="a" />
        <BaseSelectItem label="B" value="b" />
        <BaseSelectItem label="C" value="c" />
      </BaseSelect>`,
  }),
};

export default meta;
type Story = StoryObj<typeof BaseSelect>;

export const Default: Story = {
  args: {
    modelValue: "a",
  },
};

export const Placeholder: Story = {
  args: {
    placeholder: "placeholder",
  },
};

export const Disabled: Story = {
  args: {
    modelValue: "a",
    disabled: true,
  },
};
