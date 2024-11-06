/**
 * デフォルトエンジンの最新情報関連のモジュール
 */

import { z } from "zod";

/** パッケージ情報のスキーマ */
const EngineVariantSchema = z.object({
  version: z.string(),
  packages: z
    .object({
      url: z.string(),
      name: z.string(),
      size: z.number(),
      hash: z.string().optional(),
    })
    .array(),
});

/** デフォルトエンジンの最新情報のスキーマ */
const latestDefaultEngineInfoSchema = z.object({
  formatVersion: z.number(),
  windows: z.object({
    x64: z.object({
      CPU: EngineVariantSchema,
      "GPU/CPU": EngineVariantSchema,
    }),
  }),
  macos: z.object({
    x64: z.object({
      CPU: EngineVariantSchema,
    }),
    arm64: z.object({
      CPU: EngineVariantSchema,
    }),
  }),
  linux: z.object({
    x64: z.object({
      CPU: EngineVariantSchema,
      "GPU/CPU": EngineVariantSchema,
    }),
  }),
});

/** デフォルトエンジンの最新情報を取得する */
export const fetchLatestDefaultEngineInfo = async (url: string) => {
  const response = await fetch(url);
  return latestDefaultEngineInfoSchema.parse(await response.json());
};
