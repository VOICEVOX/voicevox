import { z } from "zod";
import {
  projectFileSchema,
  serializableTrackSchema,
} from "@/infrastructures/projectFile/schema";

export type SerializableTrack = z.infer<typeof serializableTrackSchema>;

export type LatestProjectType = z.infer<typeof projectFileSchema>;

/**
 * プロジェクトファイルのフォーマットエラー
 * FIXME: Result型にする
 */
export class ProjectFileFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectFileFormatError";
  }
}
