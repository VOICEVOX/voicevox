import { z } from "zod";
import {
  projectFileSchema,
  projectFileTrackSchema,
} from "@/infrastructures/projectFile/schema";

export type ProjectFileTrack = z.infer<typeof projectFileTrackSchema>;

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
