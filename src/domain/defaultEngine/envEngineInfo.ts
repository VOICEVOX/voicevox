/**
 * デフォルトエンジンの .env 関連のモジュール
 */

import { z } from "zod";

import { engineIdSchema } from "@/type/preload";

/** .envに書くデフォルトエンジン情報のスキーマ */
export const envEngineInfoSchema = z.object({
  uuid: engineIdSchema,
  host: z.string(),
  name: z.string(),
  executionEnabled: z.boolean(), // FIXME: typeがurlのときのみ必要
  executionFilePath: z.string(), // FIXME: typeがpathのときは必須
  executionArgs: z.array(z.string()),
  path: z.string().optional(), // FIXME: typeがpathで、アンインストール可能なときは必須
  type: z.union([z.literal("path"), z.literal("downloadVvpp")]).default("path"),
  latestUrl: z.string().optional(), // FIXME: typeがdownloadVvppのときは必須
});
export type EnvEngineInfoType = z.infer<typeof envEngineInfoSchema>;

/** .envからデフォルトエンジン情報を読み込む */
export function loadEnvEngineInfos(): EnvEngineInfoType[] {
  const defaultEngineInfosEnv =
    import.meta.env.VITE_DEFAULT_ENGINE_INFOS ?? "[]";

  // FIXME: 「.envを書き換えてください」というログを出したい
  // NOTE: domainディレクトリなのでログを出す方法がなく、Errorオプションのcauseを用いてもelectron-logがcauseのログを出してくれない
  const envSchema = envEngineInfoSchema.array();
  return envSchema.parse(JSON.parse(defaultEngineInfosEnv));
}
