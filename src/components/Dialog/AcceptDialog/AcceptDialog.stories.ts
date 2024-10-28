import { userEvent, within, expect, fn } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import AcceptDialog from "./AcceptDialog.vue";

const meta: Meta<typeof AcceptDialog> = {
  component: AcceptDialog,
  args: {
    modelValue: false,
    title: "タイトル",
    heading: "見出し",
    terms: "# 見出し1\n文章文章文章\n## 見出し2\n文章文章文章",
    rejectLabel: "拒否",
    acceptLabel: "承諾",
    "onUpdate:modelValue": fn(),
    onAccept: fn(),
    onReject: fn(),
  },
  tags: ["!autodocs"], // ダイアログ系はautodocsのプレビューが正しく表示されないので無効化
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Opened: Story = {
  name: "開いている",
  args: {
    modelValue: true,
  },
};

export const Accept: Story = {
  name: "承諾ボタンを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: /承諾/ });
    await userEvent.click(button);

    // 承諾イベントが呼ばれる
    await expect(args["onAccept"]).toBeCalledWith();
  },
};

export const Reject: Story = {
  name: "拒否ボタンを押す",
  args: {
    ...Opened.args,
  },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: /拒否/ });
    await userEvent.click(button);

    // 拒否イベントが呼ばれる
    await expect(args["onReject"]).toBeCalledWith();
  },
};

export const Closed: Story = {
  name: "閉じている",
  tags: ["skip-screenshot"],
};
