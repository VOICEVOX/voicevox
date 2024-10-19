import type { Meta, StoryObj } from "@storybook/vue3";
import { fn, expect, userEvent } from "@storybook/test";
import { ref } from "vue";

import Presentation from "./Presentation.vue";

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
    offset: 0,
    zoomX: 0.25,
    tpqn: 480,
    snapType: 16,
    numMeasures: 32,
    uiLocked: false,
  },

  render: (args) => ({
    components: { Presentation },
    setup() {
      const playheadPosition = ref(480);
      return { args, playheadPosition };
    },
    template: `<Presentation v-bind="args" v-model:playheadPosition="playheadPosition" />`,
  }),
};

export default meta;
type Story = StoryObj<typeof Presentation>;

export const Default: Story = {
  name: "デフォルト",
  args: {},
};

export const WithBpmChange: Story = {
  name: "BPM変化",
  args: {
    tempos: [
      {
        bpm: 120,
        position: 0,
      },
      {
        bpm: 180,
        position: 480,
      },
      {
        bpm: 240,
        position: 960,
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

// pointerのcoords指定がうまくいかないので一旦コメントアウト。
// TODO: ちゃんと動くようにする
//
// export const MovePlayhead: Story = {
//   name: "再生位置を動かせる",
//   args: {
//     "onUpdate:playheadPosition": fn(),
//   },
//
//   play: async ({ canvasElement, args }) => {
//     const ruler = canvasElement.querySelector("svg");
//     if (!ruler) {
//       throw new Error("Ruler not found");
//     }
//     await userEvent.pointer({
//       keys: "[MouseLeft]",
//       target: ruler,
//       coords: {
//         offsetX: 10,
//         offsetY: 0,
//       },
//     });
//     await expect(args["onUpdate:playheadPosition"]).toBeCalled();
//   },
// };
