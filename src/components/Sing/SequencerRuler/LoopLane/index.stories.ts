import type { Meta, StoryObj } from "@storybook/vue3";
import { fn } from "@storybook/test";

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
    isEmpty: false,
    cursorClass: "",
    contextMenuData: [],
    onLoopAreaMouseDown: fn(),
    onLoopRangeClick: fn(),
    onLoopRangeDoubleClick: fn(),
    onStartHandleMouseDown: fn(),
    onEndHandleMouseDown: fn(),
    onContextMenu: fn(),
  },
  render: (args) => ({
    components: { Presentation },
    setup() {
      return { args };
    },
    template: `<div style="height: 40px; position: relative;"><Presentation v-bind="args" /></div>`,
  }),
};

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
    isEmpty: true,
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
