import type { Meta, StoryObj } from "@storybook/vue3-vite";

import Presentation from "./Presentation.vue";

const meta: Meta<typeof Presentation> = {
  component: Presentation,
  args: {
    width: 1000,
    offset: 0,
    loopStartX: 100,
    loopEndX: 300,
    isLoopEnabled: true,
    isDragging: false,
    cursorClass: "",
    contextMenuData: [],
    tpqn: 480,
    timeSignatures: [{ measureNumber: 1, beats: 4, beatType: 4 }],
    sequencerZoomX: 1,
    snapTicks: 480,
  },
  decorators: [
    () => ({
      template: `<div style="position: relative; width: 800px; height: 40px;"><story /></div>`,
    }),
  ],
} satisfies Meta<typeof Presentation>;

// 表示のみ

export default meta;
type Story = StoryObj<typeof Presentation>;

export const Default: Story = {
  name: "デフォルト",
  args: {},
};

export const Disabled: Story = {
  name: "無効状態",
  args: {
    isLoopEnabled: false,
  },
};

export const Empty: Story = {
  name: "空の状態",
  args: {
    loopStartX: 0,
    loopEndX: 0,
  },
};

export const DraggingEnabled: Story = {
  name: "ドラッグ中(有効)",
  args: {
    isLoopEnabled: true,
    isDragging: true,
    cursorClass: "cursor-ew-resize",
  },
};

export const DraggingDisabled: Story = {
  name: "ドラッグ中(無効)",
  args: {
    isLoopEnabled: false,
    isDragging: true,
    cursorClass: "cursor-ew-resize",
  },
};

export const LongLoop: Story = {
  name: "長いループ範囲",
  args: {
    loopStartX: 100,
    loopEndX: 800,
  },
};

export const ShortLoop: Story = {
  name: "短いループ範囲",
  args: {
    loopStartX: 100,
    loopEndX: 150,
  },
};
