import { userEvent, within, expect, fn } from "@storybook/test";
import { Meta, StoryObj } from "@storybook/vue3";
import TimeSignatureChangeDialog from "./TimeSignatureChangeDialog.vue";
import { DEFAULT_BEAT_TYPE, DEFAULT_BEATS } from "@/sing/domain";

const meta: Meta<typeof TimeSignatureChangeDialog> = {
  component: TimeSignatureChangeDialog,
  args: {
    modelValue: true,
    timeSignatureChange: {
      beats: DEFAULT_BEATS,
      beatType: DEFAULT_BEAT_TYPE,
    },
    mode: "add",

    onOk: fn(),
    onHide: fn(),
  },
  tags: ["!autodocs"], // ダイアログ系はautodocsのプレビューが正しく表示されないので無効化
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

    const input = canvas.getByLabelText("拍子の分子");
    await userEvent.clear(input);
    await userEvent.type(input, "3");

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

    const input = canvas.getByLabelText("拍子の分子");
    await userEvent.clear(input);
    await userEvent.type(input, "6");

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
