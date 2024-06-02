import { State } from "@/store/type";

export type SongState = Pick<
  State,
  "tracks" | "tpqn" | "tempos" | "timeSignatures"
>;
