/**
 * デフォルトエンジンの最新情報関連のモジュール
 */

import { z } from "zod";

/** パッケージ（vvppやvvppp１ファイル）ごとのスキーマ */
const defaultEnginePackageSchema = z.object({
  url: z.string(),
  name: z.string(),
  size: z.number(),
  hash: z.string().optional(),
});

/** デバイスごとのスキーマ */
const defaultEngineDeviceSchema = z.object({
  version: z.string(),
  packages: z.array(defaultEnginePackageSchema),
});

/** デフォルトエンジンの更新情報のスキーマ */
const defaultEngineInfosSchema = z.object({
  formatVersion: z.number(),
  windows: z.object({
    x64: z.object({
      CPU: defaultEngineDeviceSchema,
      "GPU/CPU": defaultEngineDeviceSchema,
    }),
  }),
  macos: z.object({
    x64: z.object({
      CPU: defaultEngineDeviceSchema,
    }),
    arm64: z.object({
      CPU: defaultEngineDeviceSchema,
    }),
  }),
  linux: z.object({
    x64: z.object({
      CPU: defaultEngineDeviceSchema,
      "GPU/CPU": defaultEngineDeviceSchema,
    }),
  }),
});

/** デフォルトエンジンの更新情報を取得する */
export const fetchDefaultEngineInfos = async (url: string) => {
  const response = await fetch(url);
  return defaultEngineInfosSchema.parse(await response.json());
};
