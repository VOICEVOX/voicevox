import { userEvent, within, expect } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import Presentation from "./Presentation.vue";

const meta: Meta<typeof Presentation> = {
  component: Presentation,
  args: {
    modelValue: false,
  },
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

    expect(args["onUpdate:modelValue"]).toBeCalledWith(false);
  },
};

export const SkipThisVersion: Story = {
  name: "スキップボタンを押す",
  args: { ...Opened.args, latestVersion: "9.9.9" },
  play: async ({ args }) => {
    const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

    const button = canvas.getByRole("button", {
      name: /このバージョンをスキップ/,
    });
    await userEvent.click(button);

    expect(args["onSkipThisVersionClick"]).toBeCalledWith("9.9.9");
    expect(args["onUpdate:modelValue"]).toBeCalledWith(false);
  },
};

// export const OpenOfficialSite: Story = {
//   name: "公式サイトを開くボタンを押す",
//   args: { ...Opened.args },
//   play: async () => {
//     const canvas = within(document.body); // ダイアログなので例外的にdocument.bodyを使う

//     const button = canvas.getByRole("button", {
//       name: /公式サイトを開く/,
//     });
//     await userEvent.click(button);

//     expect(window.open).toBeCalledWith("https://example.com", "_blank");
//   },
// };

export const Closed: Story = {
  name: "閉じている",
};
