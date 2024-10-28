import { userEvent, within, expect, fn } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import MessageDialog from "./MessageDialog.vue";

const meta: Meta<typeof MessageDialog> = {
  component: MessageDialog,
  args: {
    type: "info",
    modelValue: true,
    title: "タイトル",
    message: "メッセージ",

    onOk: fn(),
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

export const OpenedMultiline: Story = {
  name: "開いている：複数行",
  args: {
    modelValue: true,
    message: "メッセージ\n複数行",
  },
};

export const Close: Story = {
  name: "OKを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: "OK" });
    await userEvent.click(button);

    await expect(args["onOk"]).toBeCalled();
  },
};

export const Closed: Story = {
  name: "閉じている",
  tags: ["skip-screenshot"],
  args: {
    modelValue: false,
  },
};
