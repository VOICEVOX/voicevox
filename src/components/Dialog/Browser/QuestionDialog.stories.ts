import { userEvent, within, expect } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import QuestionDialog from "./QuestionDialog.vue";

const meta: Meta<typeof QuestionDialog> = {
  component: QuestionDialog,
  args: {
    type: "info",
    modelValue: true,
    title: "タイトル",
    message: "メッセージ",
    buttons: ["A", "B", "C"],
  },
  tags: ["!autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Opened: Story = {
  name: "開いている",
  args: {
    modelValue: true,
  },
};

export const Close: Story = {
  name: "Aを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: "A" });
    await userEvent.click(button);

    await expect(args["onOk"]).toBeCalledWith({ index: 0 });
  },
};

export const Closed: Story = {
  name: "閉じている",
  args: {
    modelValue: false,
  },
};
