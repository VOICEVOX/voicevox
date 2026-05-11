/**
 * デフォルトエンジンの .env 関連のモジュール
 */

import path from "node:path";
import { z } from "zod";

import { engineIdSchema } from "@/type/preload";
import { isElectron, isNode } from "@/helpers/platform";

const ALLOWED_ENV_VARS = [
  "LOCALAPPDATA",
  "APPDATA",
  "USERPROFILE",
  "HOME",
  "TEMP",
];

/** 文字列内の環境変数を展開する */
function expandEnvVars(str: string): string {
  if (!str || typeof str !== "string") return str;

  let result = str;

  // Windows、Linux、macOSのディレクトリ展開
  result = result.replace(/%([^%]+)%/g, (match: string, name: string) => {
    const upperName = name.toUpperCase();
    if (ALLOWED_ENV_VARS.includes(upperName)) {
      const value = process.env[upperName] ?? process.env[name];
      return value ?? match;
    }
    return match;
  });

  result = result.replace(/\${([^}]+)}/g, (match: string, name: string) => {
    const upperName = name.toUpperCase();
    if (ALLOWED_ENV_VARS.includes(upperName)) {
      const value = process.env[upperName] ?? process.env[name];
      return value ?? match;
    }
    return match;
  });

  result = result.replace(
    /\$([a-zA-Z_][a-zA-Z0-9_]*)/g,
    (match: string, name: string) => {
      const upperName = name.toUpperCase();
      if (ALLOWED_ENV_VARS.includes(upperName)) {
        const value = process.env[upperName] ?? process.env[name];
        return value ?? match;
      }
      return match;
    },
  );

  return path.normalize(result);
}

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
type EnvEngineInfo = z.infer<typeof envEngineInfoSchema>;

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
export function loadEnvEngineInfos(): EnvEngineInfo[] {
  const defaultEngineInfosEnv = getDefaultEngineInfosEnv();

  // FIXME: 「.envを書き換えてください」というログを出したい
  // NOTE: domainディレクトリなのでログを出す方法がなく、Errorオプションのcauseを用いてもelectron-logがcauseのログを出してくれない
  const envSchema = envEngineInfoSchema.array();
  const engineInfos = envSchema.parse(JSON.parse(defaultEngineInfosEnv));

  for (const engineInfo of engineInfos) {
    if (engineInfo.type === "path" && engineInfo.executionFilePath) {
      engineInfo.executionFilePath = expandEnvVars(
        engineInfo.executionFilePath,
      );
    }
  }

  return engineInfos;
}
