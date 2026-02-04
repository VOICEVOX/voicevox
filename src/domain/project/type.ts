import type { z } from "zod";

import type {
  noteSchema,
  phonemeTimingEditSchema,
  singerSchema,
  tempoSchema,
  timeSignatureSchema,
  trackSchema,
} from "@/domain/project/schema";
import type { NoteId } from "@/type/preload";

export type Tempo = z.infer<typeof tempoSchema>;

export type TimeSignature = z.infer<typeof timeSignatureSchema>;

export type Note = z.infer<typeof noteSchema>;

export type Singer = z.infer<typeof singerSchema>;

export type Track = z.infer<typeof trackSchema>;

export type PhonemeTimingEdit = z.infer<typeof phonemeTimingEditSchema>;

export type PhonemeTimingEditData = Map<NoteId, PhonemeTimingEdit[]>;
