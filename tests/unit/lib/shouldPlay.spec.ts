import { it, expect } from "vitest";
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

const resultToArray = (tracks: Track[], result: Record<TrackId, boolean>) => {
  return tracks.map((track) => result[track.id]);
};

it("ソロのトラックがある場合、ソロのトラックのみ再生する", () => {
  const tracks = [
    createTrack({ mute: false, solo: false }),
    createTrack({ mute: false, solo: true }),
    createTrack({ mute: false, solo: false }),
  ];
  expect(resultToArray(tracks, shouldPlay(tracks))).toEqual([
    false,
    true,
    false,
  ]);
});

it("ソロのトラックがない場合、ミュートされていないトラックを再生する", () => {
  const tracks = [
    createTrack({ mute: false, solo: false }),
    createTrack({ mute: true, solo: false }),
    createTrack({ mute: false, solo: false }),
  ];
  expect(resultToArray(tracks, shouldPlay(tracks))).toEqual([
    true,
    false,
    true,
  ]);
});

it("ミュートされているトラックはソロのトラックでも再生しない", () => {
  const tracks = [
    createTrack({ mute: false, solo: false }),
    createTrack({ mute: true, solo: true }),
    createTrack({ mute: false, solo: false }),
  ];
  expect(resultToArray(tracks, shouldPlay(tracks))).toEqual([
    false,
    false,
    false,
  ]);
});
