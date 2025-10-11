import { userEvent, within, expect, fn } from "storybook/test";

import { Meta, StoryObj } from "@storybook/vue3-vite";
import VoiceLibraryPolicyDialog from "./VoiceLibraryPolicyDialog.vue";
import type { SpeakerId as SpeakerIdType } from "@/type/preload";
import { SpeakerId as toSpeakerId } from "@/type/preload";
import { getPortraitUrl } from "@/mock/engineMock/characterResourceMock";
import { uuid4 } from "@/helpers/random";

const testCharacterAId = toSpeakerId(uuid4());
const testCharacterBId = toSpeakerId(uuid4());

const samplePolicies = [
  {
    id: testCharacterAId,
    name: "テストキャラクターA",
    policy:
      "markdownテスト。**太字**。\\\n改行。\\\n[リンク](https://example.com)",
    portraitPath: getPortraitUrl(0),
  },
  {
    id: testCharacterBId,
    name: "テストキャラクターB",
    policy: Array(50).fill("長いテキスト").join(""),
    portraitPath: getPortraitUrl(1),
  },
] satisfies Array<{
  id: SpeakerIdType;
  name: string;
  policy: string;
  portraitPath: string;
}>;

const meta: Meta<typeof VoiceLibraryPolicyDialog> = {
  component: VoiceLibraryPolicyDialog,
  args: {
    modelValue: false,
    characterPolicyInfos: samplePolicies,
    onOk: fn(),
    onHide: fn(),
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

export const Ok: Story = {
  name: "確認ボタンを押す",
  args: { ...Opened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: /確認して続行/ });
    await userEvent.click(button);

    await expect(args["onOk"]).toBeCalledWith([
      testCharacterAId,
      testCharacterBId,
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

    await expect(args["onHide"]).toBeCalledWith();
  },
};

export const Closed: Story = {
  name: "閉じている",
  tags: ["skip-screenshot"],
};
