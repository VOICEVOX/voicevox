import { z } from "zod";

import { audioKeySchema, noteIdSchema, trackIdSchema } from "@/type/preload";
import {
  audioItemSchema,
  noteSchema,
  phonemeTimingEditSchema,
  singerSchema,
  tempoSchema,
  timeSignatureSchema,
} from "@/domain/project/schema";

// プロジェクトファイルのトラックのスキーマ
export const projectFileTrackSchema = z.object({
  name: z.string(),
  singer: singerSchema.optional(),
  keyRangeAdjustment: z.number(),
  volumeRangeAdjustment: z.number(),
  notes: z.array(noteSchema),
  pitchEditData: z.array(z.number()),
  volumeEditData: z.array(z.number()),
  phonemeTimingEditData: z.record(
    noteIdSchema,
    z.array(phonemeTimingEditSchema),
  ),
  solo: z.boolean(),
  mute: z.boolean(),
  gain: z.number(),
  pan: z.number(),
});

// プロジェクトファイルのスキーマ
export const projectFileSchema = z.object({
  appVersion: z.string(),
  talk: z.object({
    // description: "Attribute keys of audioItems.",
    audioKeys: z.array(audioKeySchema),
    // description: "VOICEVOX states per cell",
    audioItems: z.record(audioKeySchema, audioItemSchema),
  }),
  song: z.object({
    tpqn: z.number(),
    tempos: z.array(tempoSchema),
    timeSignatures: z.array(timeSignatureSchema),
    tracks: z.record(trackIdSchema, projectFileTrackSchema),
    trackOrder: z.array(trackIdSchema),
  }),
});
