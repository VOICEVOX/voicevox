import { userEvent, within, expect, fn } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import Presentation from "./Presentation.vue";

const meta: Meta<typeof Presentation> = {
  component: Presentation,
  args: {
    modelValue: false,
    latestVersion: "1.0.0",
    newUpdateInfos: [
      {
        version: "1.1.0",
        descriptions: ["追加機能１", "追加機能２"],
        contributors: ["これは表示されないはず"],
      },
      {
        version: "1.0.1",
        descriptions: ["バグ修正"],
        contributors: ["これは表示されないはず"],
      },
    ],
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

export const Close: Story = {
  name: "閉じるボタンを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: /閉じる/ });
    await userEvent.click(button);

    // ダイアログを閉じるイベントが呼ばれる
    expect(args["onUpdate:modelValue"]).toBeCalledWith(false);
  },
};

export const SkipThisVersion: Story = {
  name: "スキップボタンを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", {
      name: /このバージョンをスキップ/,
    });
    await userEvent.click(button);

    // スキップイベントが呼ばれる
    expect(args["onSkipThisVersionClick"]).toBeCalledWith("1.0.0");
    // ダイアログを閉じるイベントが呼ばれる
    expect(args["onUpdate:modelValue"]).toBeCalledWith(false);
  },
};

export const OpenOfficialSite: Story = {
  name: "公式サイトを開くボタンを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    window.open = fn();

    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", {
      name: /公式サイトを開く/,
    });
    await userEvent.click(button);

    // 公式サイトが開かれる
    expect(window.open).toBeCalledWith(
      "https://voicevox.hiroshiba.jp/",
      "_blank",
    );
    // ダイアログを閉じるイベントが呼ばれる
    expect(args["onUpdate:modelValue"]).toBeCalledWith(false);
  },
};

export const Closed: Story = {
  name: "閉じている",
};
