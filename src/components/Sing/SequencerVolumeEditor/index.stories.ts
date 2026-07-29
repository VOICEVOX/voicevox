import type { Meta, StoryObj } from "@storybook/vue3-vite";
import Presentation from "./Presentation.vue";
import { setThemeToCss } from "@/domain/dom";
import { themes } from "@/domain/theme";
import { relativeVolumeEditMode } from "@/sing/volumeEditMode";

const effectiveFramewise = Array.from({ length: 240 }, (_, frame) =>
  relativeVolumeEditMode.toStoredValue(Math.sin(frame / 24) * 4),
);

const meta = {
  component: Presentation,
  args: {
    viewportInfo: {
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
    },
    effectiveFramewise,
    previewEraseRanges: [],
    tempos: [{ position: 0, bpm: 120 }],
    tpqn: 480,
    editorFrameRate: 93.75,
    previewMode: "IDLE",
    cursorState: "UNSET",
    tooltipData: undefined,
    highlightedEditableRange: undefined,
    tool: "DRAW",
    isDark: false,
    uiLocked: false,
    volumeEditMode: relativeVolumeEditMode,
  },
  decorators: [
    (_story, context) => ({
      setup() {
        const { isDark = false } = context.args as { isDark?: boolean };
        const theme = themes.find((theme) => theme.isDark === isDark);
        if (theme != undefined) {
          setThemeToCss(theme);
        }
      },
      template: `<div style="width: 900px; height: 240px;"><story /></div>`,
    }),
  ],
} satisfies Meta<typeof Presentation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = {
  args: {
    isDark: true,
  },
  globals: {
    theme: "dark",
  },
};
