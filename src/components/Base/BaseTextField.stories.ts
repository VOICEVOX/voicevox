import type { Meta, StoryObj } from "@storybook/vue3";

import BaseTextField from "./BaseTextField.vue";

const meta: Meta<typeof BaseTextField> = {
  component: BaseTextField,
};

export default meta;
type Story = StoryObj<typeof BaseTextField>;

export const Default: Story = {};

export const Placeholder: Story = {
  args: {
    placeholder: "Placeholder",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const ReadOnly: Story = {
  args: {
    readonly: true,
  },
};

export const HasError: Story = {
  args: {
    hasError: true,
  },
  render: (args) => ({
    components: { BaseTextField },
    setup() {
      return { args };
    },
    template: `
      <BaseTextField v-bind="args">
        <template #error>
          ERROR TEXT
        </template>
      </BaseTextField>`,
  }),
};
