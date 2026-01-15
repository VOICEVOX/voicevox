import { z } from "zod";

import {
  engineIdSchema,
  noteIdSchema,
  presetKeySchema,
  speakerIdSchema,
  styleIdSchema,
} from "@/type/preload";

// トーク系のスキーマ
export const moraSchema = z.object({
  text: z.string(),
  vowel: z.string(),
  vowelLength: z.number(),
  pitch: z.number(),
  consonant: z.string().optional(),
  consonantLength: z.number().optional(),
});

export const accentPhraseSchema = z.object({
  moras: z.array(moraSchema),
  accent: z.number(),
  pauseMora: moraSchema.optional(),
  isInterrogative: z.boolean().optional(),
});

export const audioQuerySchema = z.object({
  accentPhrases: z.array(accentPhraseSchema),
  speedScale: z.number(),
  pitchScale: z.number(),
  intonationScale: z.number(),
  volumeScale: z.number(),
  pauseLengthScale: z.number(),
  prePhonemeLength: z.number(),
  postPhonemeLength: z.number(),
  outputSamplingRate: z.union([z.number(), z.literal("engineDefault")]),
  outputStereo: z.boolean(),
  kana: z.string().optional(),
});

export const morphingInfoSchema = z.object({
  rate: z.number(),
  targetEngineId: engineIdSchema,
  targetSpeakerId: speakerIdSchema,
  targetStyleId: styleIdSchema,
});

export const audioItemSchema = z.object({
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
  lyric: z.union([z.string(), z.undefined()]), // 歌詞未入力のときはundefined
});

export const singerSchema = z.object({
  engineId: engineIdSchema,
  styleId: styleIdSchema,
});

export const phonemeTimingEditSchema = z.object({
  phonemeIndexInNote: z.number(), // ノート内での音素の順番
  offsetSeconds: z.number(), // 単位は秒
});

export const trackSchema = z.object({
  name: z.string(),
  singer: singerSchema.optional(),
  keyRangeAdjustment: z.number(), // 音域調整量
  volumeRangeAdjustment: z.number(), // 声量調整量
  notes: z.array(noteSchema),
  pitchEditData: z.array(z.number()), // 値の単位はHzで、データが無いところはVALUE_INDICATING_NO_DATAの値
  volumeEditData: z.array(z.number()), // 値は0以上の振幅、データが無いところはVALUE_INDICATING_NO_DATAの値
  phonemeTimingEditData: z.map(noteIdSchema, z.array(phonemeTimingEditSchema)), // 音素タイミングの編集データはノートと紐づけて保持

  solo: z.boolean(),
  mute: z.boolean(),
  gain: z.number(),
  pan: z.number(),
});
