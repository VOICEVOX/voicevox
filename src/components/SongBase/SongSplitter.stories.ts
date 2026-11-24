import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { fn } from "storybook/test";

import SongSplitterGroup from "./SongSplitterGroup.vue";
import SongSplitterPanel from "./SongSplitterPanel.vue";
import SongSplitterResizeHandle from "./SongSplitterResizeHandle.vue";

type Args = {
  direction: "horizontal" | "vertical";
  hitArea?: "both" | "start" | "end";
  disabled?: boolean;
  onResizeCommit: (size: number) => void;
};

const meta: Meta<Args> = {
  component: SongSplitterGroup as Record<
    keyof typeof SongSplitterGroup,
    unknown
  >,
  args: {
    onResizeCommit: fn(),
  },
  render: (args) => ({
    components: {
      SongSplitterGroup,
      SongSplitterPanel,
      SongSplitterResizeHandle,
    },
    setup() {
      return { args };
    },
    template: `
      <div style="width: 640px; height: 400px; border: 1px solid var(--scheme-color-song-border)">
        <SongSplitterGroup :direction="args.direction">
          <SongSplitterPanel>
            <div style="height: 100%; padding: 8px; box-sizing: border-box">エディタ</div>
          </SongSplitterPanel>
          <SongSplitterResizeHandle :hitArea="args.hitArea" :disabled="args.disabled" />
          <SongSplitterPanel sizeUnit="px" :defaultSize="160" :minSize="80" :maxSize="300" @resizeCommit="args.onResizeCommit">
            <div style="height: 100%; padding: 8px; box-sizing: border-box; background: var(--scheme-color-surface-container-highest)">パネル（80〜300px）</div>
          </SongSplitterPanel>
        </SongSplitterGroup>
      </div>`,
  }),
};

export default meta;
type Story = StoryObj<Args>;

export const Vertical: Story = {
  args: {
    direction: "vertical",
  },
};

export const Horizontal: Story = {
  args: {
    direction: "horizontal",
  },
};

export const HitAreaEnd: Story = {
  args: {
    direction: "vertical",
    hitArea: "end",
  },
};

export const Disabled: Story = {
  args: {
    direction: "vertical",
    disabled: true,
  },
};
