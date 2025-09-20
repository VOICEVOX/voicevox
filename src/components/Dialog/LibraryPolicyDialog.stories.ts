import { userEvent, within, expect, fn } from "storybook/test";

import { Meta, StoryObj } from "@storybook/vue3-vite";
import LibraryPolicyDialog from "./LibraryPolicyDialog.vue";
import type { SpeakerId as SpeakerIdType } from "@/type/preload";
import { SpeakerId as toSpeakerId } from "@/type/preload";
import { getPortraitUrl } from "@/mock/engineMock/characterResourceMock";

const samplePolicies = [
  {
    id: toSpeakerId("00000000-0000-0000-0000-000000000001"),
    name: "テストキャラクターA",
    policy:
      "markdownテスト。**太字**。\\\n改行。\\\n[リンク](https://example.com)",
    portraitPath: getPortraitUrl(0),
  },
  {
    id: toSpeakerId("00000000-0000-0000-0000-000000000002"),
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

const meta: Meta<typeof LibraryPolicyDialog> = {
  component: LibraryPolicyDialog,
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
      toSpeakerId("7ffcb7ce-00ec-4bdc-82cd-45a8889e43ff"),
      toSpeakerId("388f246b-8c41-4ac1-8e2d-5d79f3ff56d9"),
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
