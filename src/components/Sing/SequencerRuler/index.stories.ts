import type { Meta, StoryObj } from "@storybook/vue3";
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
  args: {},
};
