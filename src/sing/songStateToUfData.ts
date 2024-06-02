import { UfData } from "@sevenc-nanashi/utaformatix-ts";
import { SongState } from "@/store/type";

export const songStateToUfData = (
  { tracks, tpqn, tempos, timeSignatures }: SongState,
  projectName: string,
): UfData => {
  const convertTicks = (ticks: number) => Math.round((ticks / tpqn) * 480);
  return {
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
};
