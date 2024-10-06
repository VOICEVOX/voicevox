/**
 * デフォルトエンジン関連のモジュール
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
const defaultEngineUpdateInfoSchema = z.object({
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
export const fetchDefaultEngineUpdateInfo = async (url: string) => {
  const response = await fetch(url);
  return defaultEngineUpdateInfoSchema.parse(await response.json());
};

/** 実行環境に合うパッケージを取得する */
export const getSuitablePackages = (
  updateInfo: z.infer<typeof defaultEngineUpdateInfoSchema>,
): z.infer<typeof defaultEngineDeviceSchema> => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const eachOs =
    updateInfo[
      // @ts-expect-error 存在しないOSを指定している可能性もある
      { win32: "windows", darwin: "macos", linux: "linux" }[process.platform]
    ];
  if (eachOs == undefined)
    throw new Error(`Unsupported platform: ${process.platform}`);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const eachArch = eachOs[process.arch];
  if (eachArch == undefined)
    throw new Error(`Unsupported arch: ${process.arch}`);

  // GPU版があればそれを使う
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const [gpuPackage, cpuPackage] = [eachArch["GPU/CPU"], eachArch.CPU];
  if (gpuPackage != undefined)
    return gpuPackage as z.infer<typeof defaultEngineDeviceSchema>;
  return cpuPackage as z.infer<typeof defaultEngineDeviceSchema>;
};
