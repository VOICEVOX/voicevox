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

const framePhonemeSchema = z.object({
  phoneme: z.string(),
  frameLength: z.number(),
  noteId: z.string().nullable().optional(),
});

const editorFrameAudioQuerySchema = z.object({
  f0: z.array(z.number()),
  volume: z.array(z.number()),
  phonemes: z.array(framePhonemeSchema),
  volumeScale: z.number(),
  outputSamplingRate: z.number(),
  outputStereo: z.boolean(),
  frameRate: z.number(),
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
    phraseQueries: z.record(z.string(), editorFrameAudioQuerySchema),
    phraseSingingPitches: z.record(z.string(), z.array(z.number())),
    phraseSingingVolumes: z.record(z.string(), z.array(z.number())),
  }),
});
