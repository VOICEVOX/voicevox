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
    sequencerZoomX: 0.25,
    sequencerZoomY: 0.75,
    tpqn: 480,
    sequencerSnapType: 16,
    numMeasures: 32,
  },

  render: (args) => ({
    components: { Presentation },
    setup() {
      return { args };
    },
    template: `<div style="width: 100vw; height: 400px; overflow: hidden;"><Presentation v-bind="args" /></div>`,
  }),
};

export default meta;
type Story = StoryObj<typeof Presentation>;

export const Default: Story = {};
