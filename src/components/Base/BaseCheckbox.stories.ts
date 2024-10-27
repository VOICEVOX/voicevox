import type { Meta, StoryObj } from "@storybook/vue3";

import { ref } from "vue";
import BaseCheckbox from "./BaseCheckbox.vue";

const meta: Meta<typeof BaseCheckbox> = {
  component: BaseCheckbox,
};

export default meta;
type Story = StoryObj<typeof BaseCheckbox>;

export const Unchecked: Story = {
  args: {
    label: "Unchecked",
  },
  render: (args) => ({
    components: { BaseCheckbox },
    setup() {
      const checked = ref(false);
      return { args, checked };
    },
    template: `<BaseCheckbox v-bind="args" v-model:checked="checked"></BaseCheckbox>`,
  }),
};

export const Checked: Story = {
  args: {
    label: "Checked",
    checked: true,
  },
  render: (args) => ({
    components: { BaseCheckbox },
    setup() {
      const checked = ref(true);
      return { args, checked };
    },
    template: `<BaseCheckbox v-bind="args" v-model:checked="checked"></BaseCheckbox>`,
  }),
};
