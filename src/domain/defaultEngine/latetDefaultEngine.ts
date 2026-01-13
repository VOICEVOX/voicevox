/**
 * デフォルトエンジンの最新情報関連のモジュール
 */

import { z } from "zod";

/** Runtime Target */
export const runtimeTargetSchema = z
  .string()
  .regex(/[a-z]+-[a-z0-9]+-[a-z0-9]+/);
export type RuntimeTarget = z.infer<typeof runtimeTargetSchema>;

/** パッケージ情報のスキーマ */
const packageInfoSchema = z.object({
  version: z.string(),
  label: z.string(),
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

/**
 * 実行環境に合うパッケージを取得する。GPU版があってもCPU版を返す。
 * TODO: どのデバイス版にするかはユーザーが選べるようにするべき。
 */
export const getSuitablePackageInfo = (
  updateInfo: z.infer<typeof latestDefaultEngineInfoSchema>,
): PackageInfo => {
  const platform = process.platform;
  const arch = process.arch;

  let target;
  if (platform === "win32" && arch === "x64") {
    target = "windows-x64-cpu" as const;
  } else if (platform === "darwin" && arch === "x64") {
    target = "macos-x64-cpu" as const;
  } else if (platform === "darwin" && arch === "arm64") {
    target = "macos-arm64-cpu" as const;
  } else if (platform === "linux" && arch === "x64") {
    target = "linux-x64-cpu" as const;
  } else {
    throw new Error(`Unsupported platform: ${platform} ${arch}`);
  }

  return updateInfo.packages[target];
};
