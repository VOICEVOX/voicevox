import { userEvent, within, expect, fn } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import TempoOrTimeSignatureChangeDialog from "./TempoOrTimeSignatureChangeDialog.vue";

const meta: Meta<typeof TempoOrTimeSignatureChangeDialog> = {
  component: TempoOrTimeSignatureChangeDialog,
  args: {
    modelValue: true,
    timeSignatureChange: undefined,
    tempoChange: undefined,

    onOk: fn(),
    "onUpdate:modelValue": fn(),
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

export const CancelClose: Story = {
  name: "キャンセルボタンを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: /キャンセル/ });
    await userEvent.click(button);

    // ダイアログを閉じるイベントが呼ばれ、onOkは呼ばれない
    await expect(args["onOk"]).not.toBeCalled();
    await expect(args["onUpdate:modelValue"]).toBeCalledWith(false);
  },
};

export const Closed: Story = {
  name: "閉じている",
};
