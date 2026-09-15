import type { Tempo, TimeSignature, Track } from "@/domain/project/type";

export type VoicevoxScore = {
  tracks: Track[];
  tpqn: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
};
