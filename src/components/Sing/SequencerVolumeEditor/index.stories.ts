import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { computed, provide } from "vue";
import Presentation from "./Presentation.vue";
import { numMeasuresInjectionKey } from "@/components/Sing/ScoreSequencer.vue";
import { setThemeToCss } from "@/domain/dom";
import { themes } from "@/domain/theme";
import { currentVolumeEditMode } from "@/sing/volumeEditMode";
import { useStore } from "@/store";

const effectiveFramewise = Array.from({ length: 240 }, (_, frame) =>
  currentVolumeEditMode.toStoredValue(Math.sin(frame / 24) * 4),
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
    editableFrameRanges: [{ startFrame: 0, endFrame: 240 }],
    tempos: [{ position: 0, bpm: 120 }],
    tpqn: 480,
    editorFrameRate: 93.75,
    previewMode: "IDLE",
    cursorState: "UNSET",
    tooltipData: undefined,
    tool: "DRAW",
    isDark: false,
    uiLocked: false,
  },
  decorators: [
    (_story, context) => ({
      setup() {
        const store = useStore();
        store.mutations.SET_TEMPOS({
          tempos: [{ position: 0, bpm: 120 }],
        });
        store.mutations.SET_TIME_SIGNATURES({
          timeSignatures: [{ measureNumber: 1, beats: 4, beatType: 4 }],
        });

        const { isDark = false } = context.args as { isDark?: boolean };
        const theme = themes.find((theme) => theme.isDark === isDark);
        if (theme != undefined) {
          setThemeToCss(theme);
        }

        const numMeasures = computed(() => 32);
        provide(numMeasuresInjectionKey, { numMeasures });
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
