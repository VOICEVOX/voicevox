import { Tempo, TimeSignature, Track } from "@/store/type";

export type VoicevoxScore = {
  tracks: Track[];
  tpqn: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
};
