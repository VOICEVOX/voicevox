import { SingingStoreState } from "./type";

export type Tempo = {
  position: number;
  tempo: number;
};

export type TimeSignature = {
  position: number;
  beats: number;
  beatType: number;
};

export type Note = {
  position: number;
  duration: number;
  midi: number;
  lyric: string;
};

export type Sequence = {
  resolution: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
  notes: Note[];
};

export const singingStoreState: SingingStoreState = {
  engineId: undefined,
  styleId: undefined,
  sequence: undefined,
  phrases: [],
};
