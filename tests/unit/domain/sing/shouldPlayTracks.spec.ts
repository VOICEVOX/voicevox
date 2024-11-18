import { uuid4 } from "@/helpers/random";
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
    acc.set(TrackId(uuid4()), track);
    return acc;
  }, new Map<TrackId, Track>());
};

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
    const trackIds = [...tracks.keys()];

    const result = shouldPlayTracks(tracks);
    expect([...result]).toEqual([trackIds[2], trackIds[3]]);
  });

  it("ソロのトラックが存在しない場合はミュートされていないトラックを再生する", () => {
    const tracks = toTracksMap([
      createTrack({ solo: false, mute: false }),
      createTrack({ solo: false, mute: false }),
      createTrack({ solo: false, mute: true }),
      createTrack({ solo: false, mute: true }),
    ]);
    const trackIds = [...tracks.keys()];

    const result = shouldPlayTracks(tracks);
    expect([...result]).toEqual([trackIds[0], trackIds[1]]);
  });
});
