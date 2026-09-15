import { expect, fn, userEvent, within } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/vue3-vite";
import Presentation from "./Presentation.vue";
import { UnreachableError } from "@/type/utility";

const meta: Meta<typeof Presentation> = {
  component: Presentation,
  args: {
    modelValue: true,
    "onUpdate:modelValue": fn(),
    onSelect: fn(),
  },
  tags: ["!autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Opened: Story = {
  name: "開いている",
};

export const SelectTalk: Story = {
  name: "トークを選択する",
  play: async ({ args }) => {
    const canvas = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "トーク" }));

    await expect(args.onSelect).toHaveBeenCalledWith("talk");
  },
};

export const SelectSong: Story = {
  name: "ソングを選択する",
  play: async ({ args }) => {
    const canvas = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "ソング" }));

    await expect(args.onSelect).toHaveBeenCalledWith("song");
  },
};

export const ClickBackdrop: Story = {
  name: "背景を押しても閉じない",
  play: async ({ args }) => {
    const backdrop = document.body.querySelector(".DialogOverlay");
    if (!(backdrop instanceof HTMLElement)) {
      throw new UnreachableError("assert: backdrop instanceof HTMLElement");
    }

    await userEvent.click(backdrop);

    await expect(args["onUpdate:modelValue"]).not.toHaveBeenCalled();
  },
};

export const Closed: Story = {
  name: "閉じている",
  tags: ["skip-screenshot"],
  args: {
    modelValue: false,
  },
};
