import { it, expect } from "vitest";
import synthvMid from "./testMidi/synthv.mid?uint8array";
import voisonaMid from "./testMidi/voisona.midi?uint8array";
import timeSigMid from "./testMidi/timeSig.mid?uint8array";
import bpmMid from "./testMidi/bpm.mid?uint8array";
import { Midi } from "@/sing/midi";

// MIDIファイルはそれぞれ以下の手順で作成：
// - synthv.mid：SynthVで作成（synthv.svp、Synthesizer V Studio Pro 1.11.0）
// - voisona.mid：Voisonaで作成（voisona.tssln、VoiSona Version 1.9.2.0

it("BPMをパースできる", async () => {
  const midi = new Midi(bpmMid);
  const ticksPerBeat = midi.ticksPerBeat;
  expect(midi.tempos).toEqual([
    { ticks: 0, bpm: 120 },
    { ticks: ticksPerBeat * 4, bpm: 180 },
    { ticks: ticksPerBeat * 8, bpm: 240 },
  ]);
});

const lyricExpectation: [noteNumber: number, lyric: string][] = [
  [60, "ど"],
  [62, "れ"],
  [64, "み"],
  [65, "ふぁ"],
  [67, "そ"],
  [69, "ら"],
  [71, "し"],
  [72, "ど"],
];

it("SynthVのノートと歌詞をパースできる", async () => {
  const midi = new Midi(synthvMid);
  const ticksPerBeat = midi.ticksPerBeat;
  expect(midi.tracks[1].notes).toEqual(
    lyricExpectation.map(([noteNumber, lyric], index) => ({
      ticks: index * ticksPerBeat,
      noteNumber,
      duration: ticksPerBeat,
      lyric,
    }))
  );
});
it("VoiSonaのノートと歌詞をパースできる", async () => {
  const midi = new Midi(synthvMid);
  const ticksPerBeat = midi.ticksPerBeat;
  expect(midi.tracks[1].notes).toEqual(
    lyricExpectation.map(([noteNumber, lyric], index) => ({
      ticks: index * ticksPerBeat,
      noteNumber,
      duration: ticksPerBeat,
      lyric,
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
