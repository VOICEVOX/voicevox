import { userEvent, within, expect, fn } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import FileNameTemplateDialog from "./FileNameTemplateDialog.vue";
import {
  buildAudioFileNameFromRawData,
  DEFAULT_AUDIO_FILE_BASE_NAME_TEMPLATE,
} from "@/store/utility";

const meta: Meta<typeof FileNameTemplateDialog> = {
  component: FileNameTemplateDialog,
  args: {
    availableTags: [
      "index",
      "characterName",
      "styleName",
      "text",
      "date",
      "projectName",
    ],
    defaultTemplate: DEFAULT_AUDIO_FILE_BASE_NAME_TEMPLATE,
    savedTemplate: "",
    fileNameBuilder: buildAudioFileNameFromRawData,
    "onUpdate:template": fn(),
    "onUpdate:openDialog": fn(),
  },
  tags: ["!autodocs"], // ダイアログ系はautodocsのプレビューが正しく表示されないので無効化
};

export default meta;
type Story = StoryObj<typeof meta>;

const getErrorMessage = (input: HTMLInputElement) => {
  const element =
    input.parentElement?.parentElement?.parentElement?.querySelector(
      ".q-field__messages",
    );
  if (!element) {
    throw new Error("エラーメッセージが見つかりませんでした");
  }
  return element.textContent;
};

export const Opened: Story = {
  name: "開いている",
  args: {
    openDialog: true,
  },
};

const createInvalidInputPlay =
  (inputValue: string, expectedMessage: RegExp | string) => async () => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const input = canvas.getByLabelText<HTMLInputElement>("ファイル名パターン");

    await userEvent.clear(input);
    if (inputValue) {
      await userEvent.type(input, inputValue);
    }
    // expect.pollが追加されるまでコメントアウト
    // https://github.com/storybookjs/storybook/issues/29060
    // await expect.poll(() => getErrorMessage(input)).toMatch(expectedMessage);
    for (let i = 0; i < 10; i++) {
      const errorMessage = getErrorMessage(input);
      if (typeof expectedMessage === "string") {
        if (errorMessage === expectedMessage) {
          return;
        }
      } else {
        if (errorMessage?.match(expectedMessage)) {
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await expect.unreachable();
  };

export const EmptyInput: Story = {
  name: "無効な入力：空欄",
  args: { ...Opened.args },
  play: createInvalidInputPlay("", "何か入力してください"),
};

export const ForbiddenInput: Story = {
  name: "無効な入力：禁じられた文字",
  args: { ...Opened.args },
  play: createInvalidInputPlay(
    "$連番$/",
    /^使用できない文字が含まれています：「.+」$/,
  ),
};

export const UnknownTagInput: Story = {
  name: "無効な入力：不明なタグ",
  args: { ...Opened.args },
  play: createInvalidInputPlay(
    "$連番$$テスト$",
    "不正なタグが存在するか、$が単体で含まれています",
  ),
};

export const UnclosedTagInput: Story = {
  name: "無効な入力：閉じられていないタグ",
  args: { ...Opened.args },
  play: createInvalidInputPlay(
    "$連番$$",
    "不正なタグが存在するか、$が単体で含まれています",
  ),
};

export const MissingIndexInput: Story = {
  name: "無効な入力：連番がない",
  args: { ...Opened.args },
  play: createInvalidInputPlay("a", "$連番$は必須です"),
};

export const Save: Story = {
  name: "保存ボタンを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const input = canvas.getByLabelText<HTMLInputElement>("ファイル名パターン");
    await userEvent.clear(input);
    await userEvent.type(input, "$連番$");

    const button = canvas.getByRole("button", { name: "確定" });
    await userEvent.click(button);

    await expect(args["onUpdate:template"]).toBeCalledWith("$連番$.wav");
    await expect(args["onUpdate:openDialog"]).toBeCalledWith(false);
  },
};

export const Unsaveable: Story = {
  name: "無効な入力だと保存ボタンが押せない",
  args: { ...Opened.args },
  play: async () => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const input = canvas.getByLabelText<HTMLInputElement>("ファイル名パターン");
    await userEvent.clear(input);
    await userEvent.type(input, "無効な入力");

    const button = canvas.getByRole("button", { name: "確定" });
    await expect(button).toBeDisabled();
  },
};

export const Close: Story = {
  name: "キャンセルボタンを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: "キャンセル" });
    await userEvent.click(button);

    // ダイアログを閉じるイベントが呼ばれる
    await expect(args["onUpdate:template"]).not.toBeCalled();
    await expect(args["onUpdate:openDialog"]).toBeCalledWith(false);
  },
};

export const Closed: Story = {
  name: "閉じている",
};
