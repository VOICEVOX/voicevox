import { userEvent, within, expect, fn } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import TempoOrTimeSignatureChangeDialog from "./TempoOrTimeSignatureChangeDialog.vue";

const meta: Meta<typeof TempoOrTimeSignatureChangeDialog> = {
  component: TempoOrTimeSignatureChangeDialog,
  args: {
    modelValue: true,
    timeSignatureChange: undefined,
    tempoChange: undefined,
    mode: "add",
    canDeleteTempo: true,
    canDeleteTimeSignature: true,

    onOk: fn(),
    "onUpdate:modelValue": fn(),
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
    tempoChange: {
      bpm: 120,
    },
    mode: "edit",
  },
};

export const CannotCloseWithoutCreate: Story = {
  name: "作成：追加されない状態だと閉じられない",
  args: { ...CreateOpened.args },
  play: async () => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: /追加する/ });
    await expect(button).toBeDisabled();
  },
};
export const CannotCloseWithoutChange: Story = {
  name: "変更：変更されない状態だと閉じられない",
  args: { ...ChangeOpened.args },
  play: async () => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", { name: /変更する/ });
    await expect(button).toBeDisabled();
  },
};
export const CannotCloseIfDeletionDisabled: Story = {
  name: "変更：削除不可の場合は削除できない",
  args: {
    ...ChangeOpened.args,
    canDeleteTempo: false,
    canDeleteTimeSignature: false,
  },
  play: async () => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const bpmToggle = canvas.getByRole("switch", { name: /BPM変更の有無/ });
    await expect(bpmToggle.getAttribute("aria-disabled")).toBe("true");

    const timeSignatureToggle = canvas.getByRole("switch", {
      name: /拍子変更の有無/,
    });
    await expect(timeSignatureToggle.getAttribute("aria-disabled")).toBe(
      "true",
    );
  },
};
export const SayChangeIfExist: Story = {
  name: "変更：どちらかが変更されていれば閉じられる",
  args: { ...ChangeOpened.args },
  play: async (context) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const okButton = canvas.getByRole("button", { name: /変更する/ });
    await context.step("BPMを変更する", async () => {
      const input = canvas.getByLabelText("BPM");
      await userEvent.clear(input);
      await userEvent.type(input, "100");

      await expect(okButton).toBeEnabled();

      await userEvent.clear(input);
      await userEvent.type(input, "120");

      await expect(okButton).toBeDisabled();
    });

    await context.step("拍子を変更する", async () => {
      const findOption = (text: string) => {
        const maybeElement = canvas
          .getAllByRole("option")
          .find((el) => el.textContent === text);
        if (!maybeElement) throw new Error("Element not found");
        return maybeElement;
      };
      const selectRoot = canvas.getByLabelText("拍子の分子");
      await userEvent.click(selectRoot);
      await new Promise((resolve) => setTimeout(resolve, 0)); // メニューが開くのを待つ

      const option = findOption("3");
      await userEvent.click(option);

      await expect(okButton).toBeEnabled();

      await userEvent.click(selectRoot);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const option2 = findOption("4");
      await userEvent.click(option2);

      await expect(okButton).toBeDisabled();
    });

    await context.step("BPMの存在を変更する", async () => {
      const tempoToggle = canvas.getByRole("switch", {
        name: /BPM変更の有無/,
      });
      await userEvent.click(tempoToggle);

      await expect(okButton).toBeEnabled();

      await userEvent.click(tempoToggle);

      await expect(okButton).toBeDisabled();
    });

    await context.step("拍子の存在を変更する", async () => {
      const timeSignatureToggle = canvas.getByRole("switch", {
        name: /拍子変更の有無/,
      });
      await userEvent.click(timeSignatureToggle);

      await expect(okButton).toBeEnabled();

      await userEvent.click(timeSignatureToggle);

      await expect(okButton).toBeDisabled();
    });
  },
};

export const ClickOk: Story = {
  name: "OKボタンを押す：作成",
  args: { ...CreateOpened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const bpmToggle = canvas.getByRole("switch", { name: /BPM変更の有無/ });
    await userEvent.click(bpmToggle);
    const bpmInput = canvas.getByLabelText("BPM");
    await userEvent.clear(bpmInput);
    await userEvent.type(bpmInput, "100");

    const button = canvas.getByRole("button", { name: /追加する/ });
    await userEvent.click(button);

    await expect(args["onOk"]).toBeCalledWith({
      timeSignatureChange: undefined,
      tempoChange: {
        bpm: 100,
      },
    });
    await expect(args["onUpdate:modelValue"]).toBeCalledWith(false);
  },
};

export const ClickDelete: Story = {
  name: "OKボタンを押す：削除",
  args: { ...ChangeOpened.args },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const bpmToggle = canvas.getByRole("switch", { name: /BPM変更の有無/ });
    await userEvent.click(bpmToggle);
    const timeSignatureToggle = canvas.getByRole("switch", {
      name: /拍子変更の有無/,
    });
    await userEvent.click(timeSignatureToggle);

    const button = canvas.getByRole("button", { name: /削除する/ });
    await userEvent.click(button);

    await expect(args["onOk"]).toBeCalledWith({
      timeSignatureChange: undefined,
      tempoChange: undefined,
    });
    await expect(args["onUpdate:modelValue"]).toBeCalledWith(false);
  },
};

export const CancelClose: Story = {
  name: "キャンセルボタンを押す",
  args: { ...ChangeOpened.args },
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
  args: {
    modelValue: false,
  },
};
