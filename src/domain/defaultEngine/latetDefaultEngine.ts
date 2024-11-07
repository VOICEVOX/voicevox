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
export type EngineVariant = z.infer<typeof engineVariantSchema>;

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

/**
 * 実行環境に合うパッケージを取得する。GPU版があればGPU版を返す。
 * FIXME: どのデバイス版にするかはユーザーが選べるようにするべき。
 */
export const getSuitableVariant = (
  updateInfo: z.infer<typeof latestDefaultEngineInfoSchema>,
): EngineVariant => {
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
