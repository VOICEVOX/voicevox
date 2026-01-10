/**
 * デフォルトエンジンの最新情報関連のモジュール
 */

import { z } from "zod";

/** パッケージ情報のスキーマ */
const packageInfoSchema = z.object({
  version: z.string(),
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

type RuntimeTarget =
  | "windows-x64-cpu"
  | "windows-x64-directml"
  | "macos-x64-cpu"
  | "macos-arm64-cpu"
  | "linux-x64-cpu"
  | "linux-x64-cuda";

/** デフォルトエンジンの最新情報のスキーマ */
const latestDefaultEngineInfoSchema = z.object({
  formatVersion: z.number(),
  packages: z.object({
    "windows-x64-cpu": packageInfoSchema,
    "windows-x64-directml": packageInfoSchema,
    "macos-x64-cpu": packageInfoSchema,
    "macos-arm64-cpu": packageInfoSchema,
    "linux-x64-cpu": packageInfoSchema,
    "linux-x64-cuda": packageInfoSchema,
  }),
});

/** デフォルトエンジンの最新情報を取得する */
export const fetchLatestDefaultEngineInfo = async (url: string) => {
  const response = await fetch(url);
  return latestDefaultEngineInfoSchema.parse(await response.json());
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

  let target: RuntimeTarget;
  if (platform === "win32" && arch === "x64") {
    target = "windows-x64-cpu";
  } else if (platform === "darwin" && arch === "x64") {
    target = "macos-x64-cpu";
  } else if (platform === "darwin" && arch === "arm64") {
    target = "macos-arm64-cpu";
  } else if (platform === "linux" && arch === "x64") {
    target = "linux-x64-cpu";
  } else {
    throw new Error(`Unsupported platform: ${platform} ${arch}`);
  }

  return updateInfo.packages[target];
};
