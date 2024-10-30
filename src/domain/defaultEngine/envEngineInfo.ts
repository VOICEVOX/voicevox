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
  executionEnabled: z.boolean(),
  executionFilePath: z.string(),
  executionArgs: z.array(z.string()),
  path: z.string().optional(),
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
