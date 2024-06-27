// TODO: エクスポート機能を実装する

import { Project as UfProject, UfData } from "@sevenc-nanashi/utaformatix-ts";
import { VoicevoxScore } from "./common";

/** Voicevoxの楽譜データをUtaformatixのProjectに変換する */
export const ufProjectFromVoicevox = (
  { tracks, tpqn, tempos, timeSignatures }: VoicevoxScore,
  projectName: string,
): UfProject => {
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
        name: `無名トラック`,
        notes: track.notes.map((note) => ({
          key: note.noteNumber,
          tickOn: convertTicks(note.position),
          tickOff: convertTicks(note.position + note.duration),
          lyric: note.lyric,
        })),
      })),
    },
  };
  return new UfProject(ufData);
};
