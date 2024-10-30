/**
 * デフォルトエンジンの最新情報関連のモジュール
 */

import { z } from "zod";

/** パッケージ情報のスキーマ */
const enginePackageSchema = z.object({
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
export type EnginePackage = z.infer<typeof enginePackageSchema>;

/** デフォルトエンジンの更新情報のスキーマ */
const defaultEngineUpdateInfoSchema = z.object({
  formatVersion: z.number(),
  windows: z.object({
    x64: z.object({
      CPU: enginePackageSchema,
      "GPU/CPU": enginePackageSchema,
    }),
  }),
  macos: z.object({
    x64: z.object({
      CPU: enginePackageSchema,
    }),
    arm64: z.object({
      CPU: enginePackageSchema,
    }),
  }),
  linux: z.object({
    x64: z.object({
      CPU: enginePackageSchema,
      "GPU/CPU": enginePackageSchema,
    }),
  }),
});

/** デフォルトエンジンの更新情報を取得する */
export const fetchDefaultEngineInfos = async (url: string) => {
  const response = await fetch(url);
  return defaultEngineUpdateInfoSchema.parse(await response.json());
};

/**
 * 実行環境に合うパッケージを取得する。GPU版があればGPU版を返す。
 * FIXME: どのデバイス版にするかはユーザーが選べるようにするべき。
 */
export const getSuitablePackages = (
  updateInfo: z.infer<typeof defaultEngineUpdateInfoSchema>,
): EnginePackage => {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "win32") {
    if (arch === "x64") {
      return updateInfo.windows.x64["GPU/CPU"];
    }
  } else if (platform === "darwin") {
    if (arch === "x64") {
      return updateInfo.macos.x64.CPU;
    } else if (arch === "arm64") {
      return updateInfo.macos.arm64.CPU;
    }
  } else if (platform === "linux") {
    if (arch === "x64") {
      return updateInfo.linux.x64["GPU/CPU"];
    }
  }

  throw new Error(`Unsupported platform: ${platform} ${arch}`);
};
