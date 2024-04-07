import { it, expect } from "vitest";
import lyricMid from "./testMidi/lyric.mid?uint8array";
import timeSigMid from "./testMidi/timeSig.mid?uint8array";
import bpmMid from "./testMidi/bpm.mid?uint8array";
import { Midi } from "@/sing/midi";

// `lyrics.mid` はSynthVで作成。（Synthesizer V Studio Pro 1.11.0）
// それ以外はsignal（https://signal.vercel.app/edit）で作成。

it("BPMをパースできる", async () => {
  const midi = new Midi(bpmMid);
  const ticksPerBeat = midi.ticksPerBeat;
  expect(midi.tempos).toEqual([
    { ticks: 0, bpm: 120 },
    { ticks: ticksPerBeat * 4, bpm: 180 },
    { ticks: ticksPerBeat * 8, bpm: 240 },
  ]);
});

it("ノートと歌詞をパースできる", async () => {
  const midi = new Midi(lyricMid);
  const ticksPerBeat = midi.ticksPerBeat;
  // SynthVの1トラック目はBPM変化しかないので、2トラック目をテストする
  expect(midi.tracks[1].notes).toEqual(
    [60, 62, 64, 65, 67, 69, 71, 72].map((noteNumber, index) => ({
      ticks: index * ticksPerBeat,
      noteNumber,
      duration: ticksPerBeat,
      lyric: "la",
    }))
  );
});

it("拍子をパースできる", async () => {
  const midi = new Midi(timeSigMid);
  const ticksPerBeat = midi.ticksPerBeat;
  expect(midi.timeSignatures).toEqual([
    { ticks: 0, numerator: 4, denominator: 4 },
    { ticks: ticksPerBeat * 4, numerator: 3, denominator: 4 },
    { ticks: ticksPerBeat * 7, numerator: 4, denominator: 8 },
  ]);
});
