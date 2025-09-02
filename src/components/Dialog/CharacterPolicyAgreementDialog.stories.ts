import { userEvent, within, expect, fn } from "storybook/test";

import { Meta, StoryObj } from "@storybook/vue3-vite";
import CharacterPolicyAgreementDialog from "./CharacterPolicyAgreementDialog.vue";
import type { SpeakerId as SpeakerIdType } from "@/type/preload";
import { SpeakerId as toSpeakerId } from "@/type/preload";

const samplePolicies = [
  {
    id: toSpeakerId("speaker-1"),
    name: "テストキャラクターA",
    policy:
      "このキャラクターの音声は非商用目的に限り利用できます。\n再配布は禁止です。",
    portraitPath: "dummy1",
  },
  {
    id: toSpeakerId("speaker-2"),
    name: "テストキャラクターB",
    policy: "商用利用には別途ライセンス契約が必要です。",
    portraitPath: "dummy2",
  },
] satisfies Array<{
  id: SpeakerIdType;
  name: string;
  policy: string;
  portraitPath: string;
}>;

const meta: Meta<typeof CharacterPolicyAgreementDialog> = {
  component: CharacterPolicyAgreementDialog,
  args: {
    dialogOpened: false,
    characterPolicyInfos: samplePolicies,
    onAccept: fn(),
    onCancel: fn(),
    "onUpdate:dialogOpened": fn(),
  },
  tags: ["!autodocs"], // ダイアログ系はautodocsのプレビューが正しく表示されないので無効化
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Opened: Story = {
  name: "開いている",
  args: {
    dialogOpened: true,
  },
};

export const Accept: Story = {
  name: "同意ボタンを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: /同意して続行/ });
    await userEvent.click(button);

    await expect(args["onAccept"]).toBeCalledWith([
      toSpeakerId("speaker-1"),
      toSpeakerId("speaker-2"),
    ]);
  },
};

export const Cancel: Story = {
  name: "キャンセルボタンを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: /キャンセル/ });
    await userEvent.click(button);

    await expect(args["onCancel"]).toBeCalledWith();
  },
};

export const Closed: Story = {
  name: "閉じている",
  tags: ["skip-screenshot"],
};
