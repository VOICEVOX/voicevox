import { z } from "zod";

import {
  audioKeySchema,
  engineIdSchema,
  noteIdSchema,
  presetKeySchema,
  speakerIdSchema,
  styleIdSchema,
} from "@/type/preload";

// トーク系のスキーマ
const moraSchema = z.object({
  text: z.string(),
  vowel: z.string(),
  vowelLength: z.number(),
  pitch: z.number(),
  consonant: z.string().optional(),
  consonantLength: z.number().optional(),
});

const accentPhraseSchema = z.object({
  moras: z.array(moraSchema),
  accent: z.number(),
  pauseMora: moraSchema.optional(),
  isInterrogative: z.boolean().optional(),
});

const audioQuerySchema = z.object({
  accentPhrases: z.array(accentPhraseSchema),
  speedScale: z.number(),
  pitchScale: z.number(),
  intonationScale: z.number(),
  volumeScale: z.number(),
  prePhonemeLength: z.number(),
  postPhonemeLength: z.number(),
  outputSamplingRate: z.union([z.number(), z.literal("engineDefault")]),
  outputStereo: z.boolean(),
  kana: z.string().optional(),
});

const morphingInfoSchema = z.object({
  rate: z.number(),
  targetEngineId: engineIdSchema,
  targetSpeakerId: speakerIdSchema,
  targetStyleId: styleIdSchema,
});

const audioItemSchema = z.object({
  text: z.string(),
  voice: z.object({
    engineId: engineIdSchema,
    speakerId: speakerIdSchema,
    styleId: styleIdSchema,
  }),
  query: audioQuerySchema.optional(),
  presetKey: presetKeySchema.optional(),
  morphingInfo: morphingInfoSchema.optional(),
});

// ソング系のスキーマ
export const tempoSchema = z.object({
  position: z.number(),
  bpm: z.number(),
});

export const timeSignatureSchema = z.object({
  measureNumber: z.number(),
  beats: z.number(),
  beatType: z.number(),
});

export const noteSchema = z.object({
  id: noteIdSchema,
  position: z.number(),
  duration: z.number(),
  noteNumber: z.number(),
  lyric: z.string(),
});

export const singerSchema = z.object({
  engineId: engineIdSchema,
  styleId: styleIdSchema,
});

export const trackSchema = z.object({
  singer: singerSchema.optional(),
  keyRangeAdjustment: z.number(), // 音域調整量
  volumeRangeAdjustment: z.number(), // 声量調整量
  notes: z.array(noteSchema),
  pitchEditData: z.array(z.number()), // 値の単位はHzで、データが無いところはVALUE_INDICATING_NO_DATAの値
});

// プロジェクトファイルのスキーマ
export const projectSchema = z.object({
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
    tracks: z.array(trackSchema),
  }),
});

export type LatestProjectType = z.infer<typeof projectSchema>;
