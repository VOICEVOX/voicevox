import { z } from "zod";
import semver from "semver";

import {
  noteSchema,
  phonemeTimingEditSchema,
  singerSchema,
  tempoSchema,
  timeSignatureSchema,
  trackSchema,
} from "@/domain/project/schema";
import { NoteId } from "@/type/preload";

export type Tempo = z.infer<typeof tempoSchema>;

export type TimeSignature = z.infer<typeof timeSignatureSchema>;

export type Note = z.infer<typeof noteSchema>;

export type Singer = z.infer<typeof singerSchema>;

export type Track = z.infer<typeof trackSchema>;

export type PhonemeTimingEdit = z.infer<typeof phonemeTimingEditSchema>;

export type PhonemeTimingEditData = Map<NoteId, PhonemeTimingEdit[]>;

// ソング系のプロジェクトファイル
export const songProjectSchema = z.object({
  projectType: z.literal("song"),
  version: z.string(),
  tempos: z.array(tempoSchema),
  timeSignatures: z.array(timeSignatureSchema),
  tracks: z.array(trackSchema),
});

export type SongProject = z.infer<typeof songProjectSchema>;

// トーク系のプロジェクトファイル
export const talkProjectSchema = z.object({
  projectType: z.literal("talk"),
  version: z.string(),
  // TODO: audioItemsを必須にする
  audioItems: z.any(),
  // TODO: audioKeysを必須にする
  audioKeys: z.any(),
});

export type TalkProject = z.infer<typeof talkProjectSchema>;

// プロジェクトファイル
export const projectSchema = z.union([songProjectSchema, talkProjectSchema]);

export type Project = z.infer<typeof projectSchema>;

export const isProject = (obj: unknown): obj is Project => {
  return projectSchema.safeParse(obj).success;
};

export const getProjectVersion = (obj: unknown): string | undefined => {
  if (isProject(obj)) {
    return obj.version;
  }
  return undefined;
};

export const validateProjectVersion = (
  projectVersion: string,
  appVersion: string,
) => {
  if (semver.gt(projectVersion, appVersion)) {
    throw new Error(
      "新しいバージョンのエディタで作成されたプロジェクトファイルです",
    );
  }
};

export const isTalkProject = (obj: unknown): obj is TalkProject => {
  return talkProjectSchema.safeParse(obj).success;
};

export const isSongProject = (obj: unknown): obj is SongProject => {
  return songProjectSchema.safeParse(obj).success;
};
