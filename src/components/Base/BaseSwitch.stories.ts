import type { Meta, StoryObj } from "@storybook/vue3";

import { ref } from "vue";
import BaseSwitch from "./BaseSwitch.vue";

const meta: Meta<typeof BaseSwitch> = {
  component: BaseSwitch,
  render: (args) => ({
    components: { BaseSwitch },
    setup() {
      const checked = ref(Boolean(args.checked));
      return { args, checked };
    },
    template: `<BaseSwitch v-bind="args" v-model:checked="checked"></BaseSwitch>`,
  }),
};

export default meta;
type Story = StoryObj<typeof BaseSwitch>;

export const Unchecked: Story = {
  args: {
    uncheckedLabel: "Off",
    checkedLabel: "On",
    checked: false,
  },
};

export const Checked: Story = {
  args: {
    uncheckedLabel: "Off",
    checkedLabel: "On",
    checked: true,
  },
};
