import { Meta, StoryObj } from "@storybook/vue3";
import Presentation from "./Presentation.vue";
import { Track } from "@/store/type";
import { createDefaultTrack } from "@/sing/domain";
import { TrackId } from "@/type/preload";
import { Routing } from "@/backend/vst/type";

const meta: Meta<typeof Presentation> = {
  component: Presentation,
  args: {},
  tags: ["!autodocs"], // ダイアログ系はautodocsのプレビューが正しく表示されないので無効化
};

export default meta;
type Story = StoryObj<typeof meta>;

const generateTrack = (index: number): [TrackId, Track] => [
  TrackId(`00000000-0000-0000-0000-${index.toString().padStart(12, "0")}`),
  {
    ...createDefaultTrack(),
    name: `Track ${index}`,
  },
];
const tracks = Object.fromEntries(
  Array(16)
    .fill(null)
    .map((_, i) => generateTrack(i + 1)),
);
const routingChannelIndex: Routing["channelIndex"] = Object.fromEntries(
  Object.keys(tracks).map((trackId, i) => {
    return [trackId, i] as const;
  }),
);

const trackOrder = Object.keys(tracks).map((trackId) => TrackId(trackId));

export const OpenedLoading: Story = {
  name: "開いている：ローディング",
  args: {
    modelValue: true,
    routingInfo: {
      status: "loading",
    },
    tracks,
    trackOrder,
  },
};

export const OpenedStereo: Story = {
  name: "開いている：ステレオ",

  args: {
    modelValue: true,
    routingInfo: {
      status: "loaded",
      data: {
        channelMode: "stereo",
        channelIndex: routingChannelIndex,
      },
    },
    tracks,
    trackOrder,
  },
};
export const OpenedMono: Story = {
  name: "開いている：モノラル",

  args: {
    modelValue: true,
    routingInfo: {
      status: "loaded",
      data: {
        channelMode: "mono",
        channelIndex: routingChannelIndex,
      },
    },
    tracks,
    trackOrder,
  },
};

export const Closed: Story = {
  name: "閉じている",
  tags: ["skip-screenshot"],
  args: {
    modelValue: false,
  },
};
