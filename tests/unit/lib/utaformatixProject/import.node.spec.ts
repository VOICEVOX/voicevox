import fs from "node:fs/promises";
import { it, expect } from "vitest";
import {
  type UfData,
  Project as UfProject,
} from "@sevenc-nanashi/utaformatix-ts";
import { ufProjectToVoicevox } from "@/sing/utaformatixProject/toVoicevox";
import { DEFAULT_BPM, DEFAULT_BEATS, DEFAULT_BEAT_TYPE } from "@/sing/domain";

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

/** テスト用の最小限のUfProjectを生成する */
const createMinimalUfProject = (
  overrides: Partial<UfData["project"]> = {},
): UfProject => {
  return new UfProject({
    formatVersion: 1,
    project: {
      name: "test",
      tracks: [],
      timeSignatures: [{ measurePosition: 0, numerator: 4, denominator: 4 }],
      tempos: [{ tickPosition: 0, bpm: 120 }],
      measurePrefix: 0,
      ...overrides,
    },
  });
};

it("先頭の小節に拍子記号がない場合、デフォルトの拍子記号を先頭に追加する", () => {
  const project = createMinimalUfProject({
    timeSignatures: [{ measurePosition: 1, numerator: 3, denominator: 4 }],
  });
  const score = ufProjectToVoicevox(project);
  expect(score.timeSignatures).toEqual([
    { measureNumber: 1, beats: DEFAULT_BEATS, beatType: DEFAULT_BEAT_TYPE },
    { measureNumber: 2, beats: 3, beatType: 4 },
  ]);
});

it("拍子記号がない場合、デフォルトの拍子記号を追加する", () => {
  const project = createMinimalUfProject({ timeSignatures: [] });
  const score = ufProjectToVoicevox(project);
  expect(score.timeSignatures).toEqual([
    { measureNumber: 1, beats: DEFAULT_BEATS, beatType: DEFAULT_BEAT_TYPE },
  ]);
});

it("先頭にposition 0のテンポがない場合、デフォルトのテンポを先頭に追加する", () => {
  const project = createMinimalUfProject({
    tempos: [{ tickPosition: 480, bpm: 150 }],
  });
  const score = ufProjectToVoicevox(project);
  expect(score.tempos[0]).toEqual({ position: 0, bpm: DEFAULT_BPM });
  expect(score.tempos[1]).toEqual({ position: 480, bpm: 150 });
});

it("テンポがない場合、デフォルトのテンポを追加する", () => {
  const project = createMinimalUfProject({ tempos: [] });
  const score = ufProjectToVoicevox(project);
  expect(score.tempos).toEqual([{ position: 0, bpm: DEFAULT_BPM }]);
});
