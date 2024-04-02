import { it, expect } from "vitest";
import { shouldPlay } from "@/sing/domain";
import { Track } from "@/store/type";

const createTrack = ({
  mute,
  solo,
}: {
  mute: boolean;
  solo: boolean;
}): Track => ({
  singer: undefined,
  notes: [],
  keyRangeAdjustment: 0,
  volumeRangeAdjustment: 0,
  pan: 0,
  volume: 1,
  mute: mute,
  solo: solo,
});

it("ソロのトラックがある場合、ソロのトラックのみ再生する", () => {
  const tracks = [
    createTrack({ mute: false, solo: false }),
    createTrack({ mute: false, solo: true }),
    createTrack({ mute: false, solo: false }),
  ];
  expect(shouldPlay(tracks)).toEqual([false, true, false]);
});

it("ソロのトラックがない場合、ミュートされていないトラックを再生する", () => {
  const tracks = [
    createTrack({ mute: false, solo: false }),
    createTrack({ mute: true, solo: false }),
    createTrack({ mute: false, solo: false }),
  ];
  expect(shouldPlay(tracks)).toEqual([true, false, true]);
});

it("ミュートされているトラックはソロのトラックでも再生しない", () => {
  const tracks = [
    createTrack({ mute: false, solo: false }),
    createTrack({ mute: true, solo: true }),
    createTrack({ mute: false, solo: false }),
  ];
  expect(shouldPlay(tracks)).toEqual([false, false, false]);
});
