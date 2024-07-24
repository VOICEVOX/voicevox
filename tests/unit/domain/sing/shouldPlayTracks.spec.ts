import { createDefaultTrack, shouldPlayTracks } from "@/sing/domain";
import { Track } from "@/store/type";
import { TrackId } from "@/type/preload";

const createTrack = ({ solo, mute }: { solo: boolean; mute: boolean }) => {
  const track = createDefaultTrack();
  track.solo = solo;
  track.mute = mute;
  return track;
};
const toTracksMap = (tracks: Track[]) => {
  return tracks.reduce((acc, track) => {
    acc.set(TrackId(crypto.randomUUID()), track);
    return acc;
  }, new Map<TrackId, Track>());
};
const findIndices = (tracks: Map<TrackId, Track>, trackIds: Set<TrackId>) =>
  [...trackIds].map((trackId) => {
    return Array.from(tracks.keys()).findIndex((id) => id === trackId);
  });

describe("shouldPlayTracks", () => {
  it("ソロのトラックが存在する場合はソロのトラックのみ再生する（ミュートは無視される）", () => {
    const tracks = toTracksMap([
      createTrack({ solo: false, mute: false }),
      createTrack({ solo: false, mute: false }),
      createTrack({ solo: true, mute: false }),
      createTrack({ solo: true, mute: false }),
      createTrack({ solo: false, mute: true }),
      createTrack({ solo: false, mute: true }),
    ]);

    const result = shouldPlayTracks(tracks);
    expect(findIndices(tracks, result).sort()).toEqual([2, 3]);
  });

  it("ソロのトラックが存在しない場合はミュートされていないトラックを再生する", () => {
    const tracks = toTracksMap([
      createTrack({ solo: false, mute: false }),
      createTrack({ solo: false, mute: false }),
      createTrack({ solo: false, mute: true }),
      createTrack({ solo: false, mute: true }),
    ]);

    const result = shouldPlayTracks(tracks);
    expect(findIndices(tracks, result).sort()).toEqual([0, 1]);
  });
});
