import { promises as fs } from "fs";
import { it, expect } from "vitest";
import { Project as UfProject } from "@sevenc-nanashi/utaformatix-ts";
import { ufProjectToVoicevox } from "@/sing/utaformatixProject/toVoicevox";

// MIDIファイルの作成情報：
// - synthv.mid：SynthVで作成（Synthesizer V Studio Pro 1.11.0、プロジェクトファイルは https://github.com/VOICEVOX/voicevox/pull/1982 を参照）
// - timeSig.mid、bpm.mid：signalで作成（https://signal.vercel.app/edit）

const midiRoot = "tests/unit/lib/utaformatixProject/";

const convertMidi = async (filename: string) => {
  const midi = await fs.readFile(midiRoot + filename);
  const project = await UfProject.fromStandardMid(midi);
  return ufProjectToVoicevox(project);
};

it("BPMを変換できる", async () => {
  const state = await convertMidi("bpm.mid");
  const tpqn = state.tpqn;
  expect(state.tempos).toEqual([
    { position: 0, bpm: 120 },
    { position: tpqn * 4, bpm: 180 },
    { position: tpqn * 8, bpm: 240 },
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

it("SynthVのノートと歌詞を変換できる", async () => {
  const state = await convertMidi("synthv.mid");
  expect(state.tracks[0].notes).toMatchObject(
    lyricExpectation.map(([noteNumber, lyric], index) => ({
      // id: string,
      noteNumber,
      position: index * state.tpqn,
      duration: state.tpqn,
      lyric,
    })),
  );
});

it("拍子を変換できる", async () => {
  const state = await convertMidi("timeSig.mid");
  expect(state.timeSignatures).toEqual([
    { measureNumber: 1, beats: 4, beatType: 4 },
    { measureNumber: 2, beats: 3, beatType: 4 },
    { measureNumber: 3, beats: 4, beatType: 8 },
  ]);
});
