/**
 * デフォルトエンジンの .env 関連のモジュール
 */

import { z } from "zod";

import { engineIdSchema } from "@/type/preload";
import { isElectron, isNode } from "@/helpers/platform";

/** .envに書くデフォルトエンジン情報のスキーマ */
const envEngineInfoSchema = z
  .object({
    uuid: engineIdSchema,
    host: z.string(),
    name: z.string(),
    executionEnabled: z.boolean(),
    executionArgs: z.array(z.string()),
  })
  .and(
    z.union([
      // エンジンをパス指定する場合
      z.object({
        type: z.literal("path").default("path"),
        executionFilePath: z.string(),
        path: z.string().optional(),
      }),
      // VVPPダウンロードする場合
      z.object({
        type: z.literal("downloadVvpp"),
        latestUrl: z.string(),
      }),
    ]),
  );
type EnvEngineInfoType = z.infer<typeof envEngineInfoSchema>;

/**
 * デフォルトエンジン情報の環境変数を取得する
 * electronのときはプロセスの環境変数を優先する。
 * NOTE: electronテスト環境を切り替えるため。テスト環境が１本化されればimport.meta.envを使う。
 */
function getDefaultEngineInfosEnv(): string {
  let engineInfos;
  if (isElectron && isNode) {
    engineInfos = process?.env?.VITE_DEFAULT_ENGINE_INFOS;
  }
  if (engineInfos == undefined) {
    engineInfos = import.meta.env.VITE_DEFAULT_ENGINE_INFOS;
  }
  if (engineInfos == undefined) {
    engineInfos = "[]";
  }
  return engineInfos;
}

/** .envからデフォルトエンジン情報を読み込む */
export function loadEnvEngineInfos(): EnvEngineInfoType[] {
  const defaultEngineInfosEnv = getDefaultEngineInfosEnv();

  // FIXME: 「.envを書き換えてください」というログを出したい
  // NOTE: domainディレクトリなのでログを出す方法がなく、Errorオプションのcauseを用いてもelectron-logがcauseのログを出してくれない
  const envSchema = envEngineInfoSchema.array();
  return envSchema.parse(JSON.parse(defaultEngineInfosEnv));
}
