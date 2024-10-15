import { TrackId } from "@/type/preload";

export type Routing = {
  channelMode: "mono" | "stereo";
  channelIndex: Record<TrackId, number>;
};
