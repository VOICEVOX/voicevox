// TODO: エクスポート機能を実装する

import type {
  Project as UfProject,
  UfData,
} from "@sevenc-nanashi/utaformatix-ts";
import type { VoicevoxScore } from "./common";

/** Voicevoxの楽譜データをUtaformatixのProjectに変換する */
export const ufProjectFromVoicevox = async (
  { tracks, tpqn, tempos, timeSignatures }: VoicevoxScore,
  projectName: string,
): Promise<UfProject> => {
  const convertTicks = (ticks: number) => Math.round((ticks / tpqn) * 480);
  const ufData: UfData = {
    formatVersion: 1,
    project: {
      measurePrefix: 0,
      name: projectName,
      tempos: tempos.map((tempo) => ({
        tickPosition: convertTicks(tempo.position),
        bpm: tempo.bpm,
      })),
      timeSignatures: timeSignatures.map((timeSignature) => ({
        measurePosition: timeSignature.measureNumber,
        numerator: timeSignature.beats,
        denominator: timeSignature.beatType,
      })),
      tracks: tracks.map((track) => ({
        name: track.name,
        notes: track.notes.map((note) => ({
          key: note.noteNumber,
          tickOn: convertTicks(note.position),
          tickOff: convertTicks(note.position + note.duration),
          lyric: note.lyric ?? "",
        })),
      })),
    },
  };
  const { Project: UfProject } = await import("@sevenc-nanashi/utaformatix-ts");
  return new UfProject(ufData);
};
