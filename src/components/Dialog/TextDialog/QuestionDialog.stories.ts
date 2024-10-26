import { userEvent, within, expect, fn, waitFor } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import QuestionDialog from "./QuestionDialog.vue";
import { UnreachableError } from "@/type/utility";

const meta: Meta<typeof QuestionDialog> = {
  component: QuestionDialog,
  args: {
    type: "info",
    modelValue: true,
    title: "タイトル",
    message: "メッセージ",
    buttons: ["A", "B", "C"],

    onOk: fn(),
    onHide: fn(),
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
  name: "Aを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: "A" });
    await userEvent.click(button);

    await expect(args["onOk"]).toBeCalledWith({ index: 0 });
  },
};

export const ClickBackdropWithoutCancel: Story = {
  name: "persistent: trueで背景を押してもキャンセル扱いにならない",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const backdrop = document.body.querySelector(".q-dialog__backdrop");
    if (!backdrop) throw new UnreachableError();
    await userEvent.click(backdrop);

    await expect(args["onOk"]).not.toBeCalled();
  },
};

export const ClickBackdropWithCancel: Story = {
  name: "persistent: falseで背景を押すとキャンセル扱いになる",
  args: { ...Opened.args, buttons: ["A", "キャンセル"], persistent: false },
  play: async ({ args }) => {
    const backdrop = document.body.querySelector(".q-dialog__backdrop");
    if (!backdrop) throw new UnreachableError();
    await userEvent.click(backdrop);

    await waitFor(() => expect(args["onHide"]).toBeCalled());
  },
};

export const Closed: Story = {
  name: "閉じている",
  tags: ["skip-screenshot"],
  args: {
    modelValue: false,
  },
};
