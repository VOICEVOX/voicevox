import type { Meta, StoryObj } from "@storybook/vue3";

import BaseTextField from "./BaseTextField.vue";

const meta: Meta<typeof BaseTextField> = {
  component: BaseTextField,
};

export default meta;
type Story = StoryObj<typeof BaseTextField>;

export const Default: Story = {
  args: {
    placeholder: "Placeholder",
    hasError: false,
    readonly: false,
    disabled: false,
  },
};

export const HasError: Story = {
  args: {
    placeholder: "Placeholder",
    hasError: true,
    readonly: false,
    disabled: false,
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
