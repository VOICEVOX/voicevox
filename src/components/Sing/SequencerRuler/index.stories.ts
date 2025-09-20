import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { provide, computed } from "vue";
import { numMeasuresInjectionKey } from "../ScoreSequencer.vue";
import Container from "./Container.vue";
import { UnreachableError } from "@/type/utility";
import type { Tempo, TimeSignature } from "@/domain/project/type";
import { useStore } from "@/store";

type StoryProps = {
  offset: number;
  numMeasures: number;
  tempos?: Tempo[];
  timeSignatures?: TimeSignature[];
};

// setupStoryStateの型を定義
type SetupStoryState = {
  tempos?: Tempo[];
  timeSignatures?: TimeSignature[];
};

const meta: Meta<StoryProps> = {
  title: "Components/Sing/SequencerRuler",
  component: Container,
  decorators: [
    (story, context) => ({
      components: { story },
      setup() {
        const store = useStore();
        // コンポーネントのプロパティからデータを取得
        const args = context.args as StoryProps;
        if (args.tempos) {
          store.commit("SET_TEMPOS", {
            tempos: args.tempos,
          });
        }
        if (args.timeSignatures) {
          store.commit("SET_TIME_SIGNATURES", {
            timeSignatures: args.timeSignatures,
          });
        }

        // setupStoryStateパラメータからデータを取得
        const setupState = context.parameters?.setupStoryState as
          | SetupStoryState
          | undefined;
        if (setupState) {
          if (setupState.tempos) {
            store.commit("SET_TEMPOS", {
              tempos: setupState.tempos,
            });
          }
          if (setupState.timeSignatures) {
            store.commit("SET_TIME_SIGNATURES", {
              timeSignatures: setupState.timeSignatures,
            });
          }
        }

        const numMeasures = computed(() => args.numMeasures ?? 32);
        provide(numMeasuresInjectionKey, { numMeasures });

        return { args };
      },
      template: `<story v-bind="args" />`, // args をstoryにバインド
    }),
  ],
  args: {
    offset: 0,
    numMeasures: 32,
  },
  argTypes: {
    offset: {
      control: { type: "number" },
    },
    numMeasures: {
      control: { type: "number" },
    },
  },
} satisfies Meta<StoryProps>;

export default meta;
type Story = StoryObj<StoryProps>;

export const Default: Story = {
  name: "デフォルト",
  args: {},
  parameters: {
    setupStoryState: {
      tempos: [{ bpm: 120, position: 0 }],
      timeSignatures: [{ beats: 4, beatType: 4, measureNumber: 1 }],
    },
  },
};

export const WithBpmChange: Story = {
  name: "テンポ変化",
  parameters: {
    setupStoryState: {
      tempos: [
        {
          bpm: 120,
          position: 0,
        },
        {
          bpm: 180,
          position: 480 * 4,
        },
        {
          bpm: 240,
          position: 480 * 8,
        },
      ],
    },
  },
};

export const WithTimeSignatureChange: Story = {
  name: "拍子変化",
  parameters: {
    setupStoryState: {
      timeSignatures: [
        {
          beats: 4,
          beatType: 4,
          measureNumber: 1,
        },
        {
          beats: 3,
          beatType: 4,
          measureNumber: 3,
        },
        {
          beats: 9,
          beatType: 16,
          measureNumber: 5,
        },
      ],
    },
  },
};

export const WithOffset: Story = {
  name: "スクロール",
  args: {
    offset: 480 * 4,
  },
};

export const Dense: Story = {
  name: "密集表示",
  parameters: {
    setupStoryState: {
      timeSignatures: [
        {
          beats: 4,
          beatType: 4,
          measureNumber: 1,
        },
      ],
      tempos: [
        {
          bpm: 120,
          position: 0,
        },
        {
          bpm: 120,
          position: 400,
        },
        {
          bpm: 120,
          position: 480,
        },
      ],
    },
  },
};

export const MovePlayhead: Story = {
  name: "再生位置を移動",
  play: async ({ canvasElement }) => {
    const ruler =
      canvasElement.querySelector<HTMLDivElement>(".sequencer-ruler");

    if (!ruler) {
      throw new UnreachableError("ruler is not found");
    }

    const rect = ruler.getBoundingClientRect();
    const width = rect.width;
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + width / 2,
      clientY: rect.top + rect.height,
    });

    ruler.dispatchEvent(event);
  },
};
