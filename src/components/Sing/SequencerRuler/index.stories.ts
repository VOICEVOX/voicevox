import type { Meta, StoryObj } from "@storybook/vue3";
import { ref } from "vue";
import { fn, expect, Mock } from "@storybook/test";

import Presentation from "./Presentation.vue";
import { UnreachableError } from "@/type/utility";

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
    sequencerZoomX: 0.25,
    tpqn: 480,
    offset: 0,
    numMeasures: 32,
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

export const Default: Story = {};

export const MovePlayhead: Story = {
  name: "再生位置を移動",
  args: {
    "onUpdate:playheadTicks": fn<(value: number) => void>(),
  },

  play: async ({ canvasElement, args }) => {
    const ruler =
      canvasElement.querySelector<HTMLDivElement>(".sequencer-ruler");

    if (!ruler) {
      throw new UnreachableError("ruler is not found");
    }
    const rectElem = canvasElement.querySelector<SVGRectElement>("rect");
    if (!rectElem) {
      throw new UnreachableError("rect is not found");
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

    rectElem.dispatchEvent(event);

    await expect(args["onUpdate:playheadTicks"]).toHaveBeenCalled();

    const onUpdateCallback = args["onUpdate:playheadTicks"] as Mock<
      (value: number) => void
    >;
    const newTick = onUpdateCallback.mock.calls[0][0];

    await expect(newTick).toBeGreaterThan(0);
  },
};
