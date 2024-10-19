import type { Meta, StoryObj } from "@storybook/vue3";

import Presentation from "./Presentation.vue";

const meta: Meta<typeof Presentation> = {
  component: Presentation,

  args: {
    timeSignatures: [
      {
        beats: 4,
        beatType: 4,
        measureNumber: 1,
      },
    ],
    zoomX: 0.25,
    zoomY: 1.0,
    tpqn: 480,
    snapType: 16,
    numMeasures: 32,
  },
};

export default meta;
type Story = StoryObj<typeof Presentation>;

export const Default: Story = {
  name: "デフォルト",
  args: {},
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
