/**
 * デフォルトエンジンの最新情報関連のモジュール
 */

import { z } from "zod";

/** Runtime Target */
export const runtimeTargetSchema = z.string().regex(/^[^-]+-[^-]+-[^-]+$/);
export type RuntimeTarget = z.infer<typeof runtimeTargetSchema>;

/** パッケージ情報のスキーマ */
const packageInfoSchema = z.object({
  version: z.string(),
  displayInfo: z.object({
    label: z.string(),
    hint: z.string(),
    order: z.number(),
    default: z.boolean().optional(),
  }),
  files: z
    .object({
      url: z.string(),
      name: z.string(),
      size: z.number(),
      hash: z.string().optional(),
    })
    .array(),
});
export type PackageInfo = z.infer<typeof packageInfoSchema>;

/** デフォルトエンジンの最新情報のスキーマ */
const latestDefaultEngineInfoSchema = z.object({
  formatVersion: z.number(),
  packages: z.record(runtimeTargetSchema, packageInfoSchema),
});

/** デフォルトエンジンの最新情報を取得する */
export const fetchLatestDefaultEngineInfo = async (url: string) => {
  const response = await fetch(url);
  return latestDefaultEngineInfoSchema.parse(await response.json());
};

/** 指定ターゲットのパッケージを取得する */
export const getPackageInfoByTarget = (
  updateInfo: z.infer<typeof latestDefaultEngineInfoSchema>,
  target: RuntimeTarget,
): PackageInfo => {
  return updateInfo.packages[target];
};
