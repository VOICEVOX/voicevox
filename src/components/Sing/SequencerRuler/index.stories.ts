import type { Meta, StoryObj } from "@storybook/vue3";
import { fn, expect, Mock } from "@storybook/test";
import { ref } from "vue";

import Presentation from "./Presentation.vue";
import { UnreachableError } from "@/type/utility";
import { ZOOM_X_MIN, ZOOM_X_MAX, ZOOM_X_STEP } from "@/sing/viewHelper";

const meta: Meta<typeof Presentation> = {
  component: Presentation,
  args: {
    tempos: [
      {
        bpm: 120,
        position: 0,
      },
    ],
    timeSignatures: [
      {
        beats: 4,
        beatType: 4,
        measureNumber: 1,
      },
    ],
    sequencerZoomX: 0.25,
    tpqn: 480,
    offset: 0,
    numMeasures: 32,
    sequencerSnapType: 16,
    uiLocked: false,
    "onUpdate:playheadTicks": fn<(value: number) => void>(),
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
    components: { Presentation },
    setup() {
      const playheadTicks = ref(0);
      return { args, playheadTicks };
    },
    template: `<Presentation v-bind="args" v-model:playheadTicks="playheadTicks" />`,
  }),
};

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
