/**
 * デフォルトエンジンの最新情報関連のモジュール
 */

import { z } from "zod";

/** パッケージ情報のスキーマ */
const engineVariantSchema = z.object({
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
      CPU: engineVariantSchema,
      "GPU/CPU": engineVariantSchema,
    }),
  }),
  macos: z.object({
    x64: z.object({
      CPU: engineVariantSchema,
    }),
    arm64: z.object({
      CPU: engineVariantSchema,
    }),
  }),
  linux: z.object({
    x64: z.object({
      CPU: engineVariantSchema,
      "GPU/CPU": engineVariantSchema,
    }),
  }),
});

/** デフォルトエンジンの最新情報を取得する */
export const fetchLatestDefaultEngineInfo = async (url: string) => {
  const response = await fetch(url);
  return latestDefaultEngineInfoSchema.parse(await response.json());
};
