import { userEvent, within, expect, fn, queries } from "@storybook/test";
import { Meta, StoryObj } from "@storybook/vue3";
// eslint-disable-next-line storybook/use-storybook-testing-library -- BoundFunctionsは@testing-library/domの型定義にしかない
import type { BoundFunctions } from "@testing-library/dom";

import TimeSignatureChangeDialog from "./TimeSignatureChangeDialog.vue";

const meta: Meta<typeof TimeSignatureChangeDialog> = {
  component: TimeSignatureChangeDialog,
  args: {
    modelValue: true,
    timeSignatureChange: undefined,
    mode: "add",

    onOk: fn(),
    onHide: fn(),
  },
  tags: ["!autodocs"], // ダイアログ系はautodocsのプレビューが正しく表示されないので無効化
};
const findOption = (canvas: BoundFunctions<typeof queries>, text: string) => {
  const maybeElement = canvas
    .getAllByRole("option")
    .find((el) => el.textContent === text);
  if (!maybeElement) throw new Error("Element not found");
  return maybeElement;
};

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateOpened: Story = {
  name: "開いている：追加",
  args: {
    modelValue: true,
    mode: "add",
  },
};
export const ChangeOpened: Story = {
  name: "開いている：変更",
  args: {
    modelValue: true,
    timeSignatureChange: {
      beats: 4,
      beatType: 4,
    },
    mode: "edit",
  },
};

export const ClickOk: Story = {
  name: "OKボタンを押す：追加",
  args: { ...CreateOpened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const selectRoot = canvas.getByLabelText("拍子の分子");
    await userEvent.click(selectRoot);
    await new Promise((resolve) => setTimeout(resolve, 0)); // メニューが開くのを待つ

    const option = findOption(canvas, "3");
    await userEvent.click(option);

    const button = canvas.getByRole("button", { name: /追加する/ });
    await userEvent.click(button);

    await expect(args["onOk"]).toBeCalledWith({
      timeSignatureChange: {
        beats: 3,
        beatType: 4,
      },
    });
  },
};

export const ClickDelete: Story = {
  name: "OKボタンを押す：編集",
  args: { ...ChangeOpened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const selectRoot = canvas.getByLabelText("拍子の分子");
    await userEvent.click(selectRoot);
    await new Promise((resolve) => setTimeout(resolve, 0)); // メニューが開くのを待つ

    const option = findOption(canvas, "6");
    await userEvent.click(option);

    const button = canvas.getByRole("button", { name: /変更する/ });
    await userEvent.click(button);

    await expect(args["onOk"]).toBeCalledWith({
      timeSignatureChange: {
        beats: 6,
        beatType: 4,
      },
    });
  },
};

export const CancelClose: Story = {
  name: "キャンセルボタンを押す",
  args: { ...ChangeOpened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: /キャンセル/ });
    await userEvent.click(button);

    await expect(args["onOk"]).not.toBeCalled();
  },
};

export const Closed: Story = {
  name: "閉じている",
  tags: ["skip-screenshot"],
  args: {
    modelValue: false,
  },
};
