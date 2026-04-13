import { ref } from "vue";
import type { Meta, StoryObj } from "@storybook/vue3-vite";

import BaseToggleGroup from "./BaseToggleGroup.vue";
import BaseToggleGroupItem from "./BaseToggleGroupItem.vue";

const meta: Meta<typeof BaseToggleGroup> = {
  component: BaseToggleGroup as Record<keyof typeof BaseToggleGroup, unknown>,
};

export default meta;
type Story = StoryObj<typeof BaseToggleGroup>;

export const Single: Story = {
  args: {
    type: "single",
  },
  render: (args) => ({
    components: { BaseToggleGroup, BaseToggleGroupItem },
    setup() {
      const modelValue = ref("a");
      return { args, modelValue };
    },
    template: `
      <BaseToggleGroup v-bind="args" v-model="modelValue">
        <BaseToggleGroupItem label="A" value="a" />
        <BaseToggleGroupItem label="B" value="b" />
        <BaseToggleGroupItem label="C" value="c" />
      </BaseToggleGroup>`,
  }),
};

export const OptionalSingle: Story = {
  args: {
    type: "optionalSingle",
  },
  render: (args) => ({
    components: { BaseToggleGroup, BaseToggleGroupItem },
    setup() {
      const modelValue = ref("a");
      return { args, modelValue };
    },
    template: `
      <BaseToggleGroup v-bind="args" v-model="modelValue">
        <BaseToggleGroupItem label="A" value="a" />
        <BaseToggleGroupItem label="B" value="b" />
        <BaseToggleGroupItem label="C" value="c" />
      </BaseToggleGroup>`,
  }),
};

export const Multiple: Story = {
  args: {
    type: "multiple",
  },
  render: (args) => ({
    components: { BaseToggleGroup, BaseToggleGroupItem },
    setup() {
      const modelValue = ref(["a"]);
      return { args, modelValue };
    },
    template: `
      <BaseToggleGroup v-bind="args" v-model="modelValue">
        <BaseToggleGroupItem label="A" value="a" />
        <BaseToggleGroupItem label="B" value="b" />
        <BaseToggleGroupItem label="C" value="c" />
      </BaseToggleGroup>`,
  }),
};
