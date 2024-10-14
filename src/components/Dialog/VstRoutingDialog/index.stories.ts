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
const tracks = Object.fromEntries([
  generateTrack(1),
  generateTrack(2),
  generateTrack(3),
]);
const routing: Routing = Object.fromEntries(
  Object.keys(tracks).map((trackId, i) => {
    const routingValue: Routing[TrackId] = [
      Array<boolean>(32).fill(false),
      Array<boolean>(32).fill(false),
    ];
    routingValue[0][i * 2] = true;
    routingValue[1][i * 2 + 1] = true;

    return [trackId, routingValue] as const;
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

export const Opened: Story = {
  name: "開いている",
  args: {
    modelValue: true,
    routingInfo: {
      status: "loaded",
      data: routing,
    },
    tracks,
    trackOrder,
  },
};

export const Closed: Story = {
  name: "閉じている",
  args: {
    modelValue: false,
  },
};
