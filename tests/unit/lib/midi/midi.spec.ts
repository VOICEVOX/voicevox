// @vitest-environment node

import { promises as fs } from "fs";
import { it, expect } from "vitest";
import { Midi } from "@/sing/midi";

// MIDIファイルの作成情報：
// - synthv.mid：SynthVで作成（Synthesizer V Studio Pro 1.11.0、プロジェクトファイルは https://github.com/VOICEVOX/voicevox/pull/1982 を参照）
// - timeSig.mid、bpm.mid：signalで作成（https://signal.vercel.app/edit）

const midiRoot = "tests/unit/lib/midi/";

it("BPMをパースできる", async () => {
  const bpmMid = await fs.readFile(midiRoot + "bpm.mid");
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
  const synthvMid = await fs.readFile(midiRoot + "synthv.mid");
  const midi = new Midi(synthvMid);
  const ticksPerBeat = midi.ticksPerBeat;
  // SynthVのMIDIファイルの1トラック目はBPM情報のみなので、2トラック目を取得
  expect(midi.tracks[1].notes).toEqual(
    lyricExpectation.map(([noteNumber, lyric], index) => ({
      ticks: index * ticksPerBeat,
      noteNumber,
      duration: ticksPerBeat,
      lyric,
    })),
  );
});

it("拍子をパースできる", async () => {
  const timeSigMid = await fs.readFile(midiRoot + "timeSig.mid");
  const midi = new Midi(timeSigMid);
  const ticksPerBeat = midi.ticksPerBeat;
  expect(midi.timeSignatures).toEqual([
    { ticks: 0, numerator: 4, denominator: 4 },
    { ticks: ticksPerBeat * 4, numerator: 3, denominator: 4 },
    { ticks: ticksPerBeat * 7, numerator: 4, denominator: 8 },
  ]);
});
