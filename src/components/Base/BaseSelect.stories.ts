import { ref } from "vue";
import type { Meta, StoryObj } from "@storybook/vue3";

import BaseSelect from "./BaseSelect.vue";
import BaseSelectItem from "./BaseSelectItem.vue";

const meta: Meta<typeof BaseSelect> = {
  component: BaseSelect,
};

export default meta;
type Story = StoryObj<typeof BaseSelect>;

export const Default: Story = {
  render: (args) => ({
    components: { BaseSelect, BaseSelectItem },
    setup() {
      const modelValue = ref("a");
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

export const Placeholder: Story = {
  args: {
    placeholder: "placeholder",
  },
  render: (args) => ({
    components: { BaseSelect, BaseSelectItem },
    setup() {
      const modelValue = ref("a");
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

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => ({
    components: { BaseSelect, BaseSelectItem },
    setup() {
      const modelValue = ref("a");
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
