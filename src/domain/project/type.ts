import type { z } from "zod";

import type {
  noteSchema,
  phonemeTimingEditSchema,
  singerSchema,
  singingTeacherSchema,
  tempoSchema,
  timeSignatureSchema,
  trackSchema,
  volumeEditValueSchema,
} from "@/domain/project/schema";
import type { NoteId } from "@/type/preload";

export type Tempo = z.infer<typeof tempoSchema>;

export type TimeSignature = z.infer<typeof timeSignatureSchema>;

export type Note = z.infer<typeof noteSchema>;

export type Singer = z.infer<typeof singerSchema>;

export type SingingTeacher = z.infer<typeof singingTeacherSchema>;

export type Track = z.infer<typeof trackSchema>;

export type VolumeEditValue = z.infer<typeof volumeEditValueSchema>;

export type PhonemeTimingEdit = z.infer<typeof phonemeTimingEditSchema>;

export type PhonemeTimingEditData = Map<NoteId, PhonemeTimingEdit[]>;
