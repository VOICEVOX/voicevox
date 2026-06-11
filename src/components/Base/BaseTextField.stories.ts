import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { expect } from "storybook/test";

import BaseTextField from "./BaseTextField.vue";
import { UnreachableError } from "@/type/utility";

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

export const UpdateModelValue: Story = {
  name: "Update modelValue",
  args: {
    modelValue: "hoge",
  },
  play: async ({ canvasElement, args }) => {
    const inputElement =
      canvasElement.querySelector<HTMLDivElement>("div.input");
    if (!inputElement) {
      throw new UnreachableError("div.input is not found");
    }
    await expect(inputElement.textContent).toBe("hoge");
    // @ts-expect-error modelValueがreadonlyだが、動いているかつ周りに影響がないため無視する
    // TODO: ちゃんとした方法があればそちらに変更する
    args.modelValue = "fuga";
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(inputElement.textContent).toBe("fuga");
  },
};
