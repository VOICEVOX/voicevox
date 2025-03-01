import { Tempo, TimeSignature, Track } from "@/store/type.ts";

export type VoicevoxScore = {
  tracks: Track[];
  tpqn: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
};
