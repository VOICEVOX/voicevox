import { userEvent, within } from "storybook/test";

import { Meta, StoryObj } from "@storybook/vue3-vite";
import SaveAllResultDialog from "./SaveAllResultDialog.vue";

const meta: Meta<typeof SaveAllResultDialog> = {
  component: SaveAllResultDialog,
  args: {
    modelValue: true,
    successArray: ["/path/to/success1.wav", "/path/to/success2.wav"],
    writeErrorArray: [
      {
        path: "/path/to/write_error.wav",
        message: "書き込み権限がありません",
      },
    ],
    engineErrorArray: [
      {
        path: "/path/to/engine_error.wav",
        message: "エンジンの応答がありません",
      },
    ],
  },
  tags: ["!autodocs"], // ダイアログ系はautodocsのプレビューが正しく表示されないので無効化
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Opened: Story = {
  name: "開いている",
  args: {},
};

export const Close: Story = {
  name: "閉じるボタンを押す",
  args: { ...Opened.args },
  play: async () => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: "閉じる" });
    await userEvent.click(button);
  },
};

export const SingleError: Story = {
  name: "エラー１つだけ",
  args: {
    successArray: [],
    writeErrorArray: [
      {
        path: "/path/to/error.wav",
        message: "ディスク容量が不足しています",
      },
    ],
    engineErrorArray: [],
  },
};

export const Mixed: Story = {
  name: "成功とエラーが混在している",
  args: {
    successArray: ["/path/to/success1.wav", "/path/to/success2.wav"],
    writeErrorArray: [
      {
        path: "/path/to/write_error.wav",
        message: "書き込み権限がありません",
      },
    ],
    engineErrorArray: [
      {
        path: "/path/to/engine_error1.wav",
        message: "エンジンの応答がありません",
      },
      {
        path: "/path/to/engine_error2.wav",
        message: "エンジンの応答がありません",
      },
    ],
  },
};

export const Closed: Story = {
  name: "閉じている",
  tags: ["skip-screenshot"],
  args: {
    modelValue: false,
  },
};
