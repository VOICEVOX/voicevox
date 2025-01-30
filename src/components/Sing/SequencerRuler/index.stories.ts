import type { Meta, StoryObj } from "@storybook/vue3";
import { fn, expect, Mock } from "@storybook/test";
import { ref, computed } from "vue";
import Presentation from "./Presentation.vue";
import GridLaneContainer from "./GridLane/Container.vue";
import ValueChangesLaneContainer from "./ValueChangesLane/Container.vue";
import LoopLaneContainer from "./LoopLane/Container.vue";

import { ZOOM_X_MIN, ZOOM_X_MAX, ZOOM_X_STEP } from "@/sing/viewHelper";
import { UnreachableError } from "@/type/utility";
import { useSequencerRuler } from "@/composables/useSequencerRuler";
import { Tempo, TimeSignature } from "@/store/type";
import { useStore } from "@/store";

const meta = {
  title: "Components/Sing/SequencerRuler",
  component: Presentation,
  // NOTE: 混合コンポーネントのため実際のstoreをデコレーター経由で利用している
  // 本来はPresentationのみのテストにすべきかもしれない
  decorators: [
    (story, context) => ({
      components: { story },
      setup() {
        // テンポや拍子の変更をエミュレートするため各storyのargsをstoreに設定する
        const store = useStore();
        if (context.args.tempos) {
          store.commit("SET_TEMPOS", {
            tempos: context.args.tempos as Tempo[],
          });
        }
        if (context.args.timeSignatures) {
          store.commit("SET_TIME_SIGNATURES", {
            timeSignatures: context.args.timeSignatures as TimeSignature[],
          });
        }
        return {};
      },
      template: `<story />`,
    }),
  ],
  args: {
    width: 1000,
    numMeasures: 32,
    offset: 0,
    tempos: [{ bpm: 120, position: 0 }] as Tempo[],
    timeSignatures: [
      { beats: 4, beatType: 4, measureNumber: 1 },
    ] as TimeSignature[],
    tpqn: 480,
    sequencerZoomX: 0.25,
    sequencerSnapType: 16,
    uiLocked: false,
    playheadX: 0,
    "onUpdate:playheadTicks": fn(),
    onDeselectAllNotes: fn(),
  },
  argTypes: {
    sequencerZoomX: {
      control: {
        type: "range",
        min: ZOOM_X_MIN,
        max: ZOOM_X_MAX,
        step: ZOOM_X_STEP,
      },
    },
  },
  render: (args) => ({
    components: {
      Presentation,
      GridLaneContainer,
      ValueChangesLaneContainer,
      LoopLaneContainer,
    },
    setup() {
      const playheadTicks = ref(0);
      const { width, playheadX, getSnappedTickFromOffsetX } = useSequencerRuler(
        {
          offset: computed(() => args.offset as number),
          numMeasures: computed(() => args.numMeasures as number),
          tpqn: computed(() => args.tpqn as number),
          timeSignatures: computed(
            () => args.timeSignatures as TimeSignature[],
          ),
          sequencerZoomX: computed(() => args.sequencerZoomX as number),
          playheadTicks: computed(() => playheadTicks.value),
          sequencerSnapType: computed(() => args.sequencerSnapType as number),
        },
      );

      return {
        args,
        playheadTicks,
        width,
        playheadX,
        getSnappedTickFromOffsetX,
      };
    },
    template: `
      <Presentation
        v-bind="args"
        :width="width"
        :playheadX="playheadX"
        :getSnappedTickFromOffsetX="getSnappedTickFromOffsetX"
        v-model:playheadTicks="playheadTicks"
      >
        <template #grid>
          <GridLaneContainer
            :numMeasures="args.numMeasures"
            :offset="args.offset"
          />
        </template>
        <template #changes>
          <ValueChangesLaneContainer
            :offset="args.offset"
            :numMeasures="args.numMeasures"
            @setPlayheadPosition="(ticks) => playheadTicks = ticks"
          />
        </template>
        <template #loop>
          <LoopLaneContainer
            :offset="args.offset"
            :numMeasures="args.numMeasures"
          />
        </template>
      </Presentation>
    `,
  }),
} satisfies Meta<typeof Presentation>;

export default meta;
type Story = StoryObj<typeof Presentation>;

export const Default: Story = {
  name: "デフォルト",
  args: {},
};

export const WithBpmChange: Story = {
  name: "テンポ変化",
  args: {
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
};

export const WithTimeSignatureChange: Story = {
  name: "拍子変化",
  args: {
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
};

export const WithOffset: Story = {
  name: "スクロール",
  args: {
    offset: 480 * 4,
  },
};

export const Dense: Story = {
  name: "密集表示",
  args: {
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
};

export const MovePlayhead: Story = {
  name: "再生位置を移動",

  play: async ({ canvasElement, args }) => {
    const ruler =
      canvasElement.querySelector<HTMLDivElement>(".sequencer-ruler");

    if (!ruler) {
      throw new UnreachableError("ruler is not found");
    }

    // userEvent.pointerは座標指定が上手くいかないので、MouseEventを使って手動でクリックをエミュレートする
    const rect = ruler.getBoundingClientRect();
    const width = rect.width;
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + width / 2,
      clientY: rect.top + rect.height,
    });

    ruler.dispatchEvent(event);

    await expect(args["onUpdate:playheadTicks"]).toHaveBeenCalled();

    const onUpdateCallback = args["onUpdate:playheadTicks"] as Mock<
      (value: number) => void
    >;
    const newTick = onUpdateCallback.mock.calls[0][0];

    await expect(newTick).toBeGreaterThan(0);
    await expect(args["onDeselectAllNotes"]).toHaveBeenCalled();
  },
};
