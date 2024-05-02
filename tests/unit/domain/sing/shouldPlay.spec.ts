import { it, expect } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { shouldPlay } from "@/sing/domain";
import { Track } from "@/store/type";
import { createInitialTrack } from "@/store/singing";
import { TrackId } from "@/type/preload";

const createTrack = ({
  mute,
  solo,
}: {
  mute: boolean;
  solo: boolean;
}): Track => {
  const track = createInitialTrack();
  track.mute = mute;
  track.solo = solo;

  return track;
};

const checkResult = (tracks: Track[], expected: boolean[]) => {
  const tracksMap = new Map<TrackId, Track>(
    tracks.map((track) => [TrackId(uuidv4()), track]),
  );
  const result = shouldPlay(tracksMap);
  for (const trackId of tracksMap.keys()) {
    expect(result[trackId]).toBe(expected.shift());
  }
};

it("ソロのトラックがある場合、ソロのトラックのみ再生する", () => {
  const tracks = [
    createTrack({ mute: false, solo: false }),
    createTrack({ mute: false, solo: true }),
    createTrack({ mute: false, solo: false }),
  ];
  checkResult(tracks, [false, true, false]);
});

it("ソロのトラックがない場合、ミュートされていないトラックを再生する", () => {
  const tracks = [
    createTrack({ mute: false, solo: false }),
    createTrack({ mute: true, solo: false }),
    createTrack({ mute: false, solo: false }),
  ];
  checkResult(tracks, [true, false, true]);
});

it("ソロのトラックはミュートを貫通する", () => {
  const tracks = [
    createTrack({ mute: false, solo: false }),
    createTrack({ mute: true, solo: true }),
    createTrack({ mute: false, solo: false }),
  ];
  checkResult(tracks, [true, true, false]);
});
