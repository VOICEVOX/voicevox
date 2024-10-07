import { z } from "zod";

import { engineIdSchema } from "@/type/preload";

/** .envに書くエンジン情報のスキーマ */
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

export type EnvEngineInfos = z.infer<typeof envEngineInfoSchema>[];

/** 環境変数を経由して.envを読み込む */
export function loadEnvEngineInfos(): EnvEngineInfos {
  const defaultEngineInfosEnv =
    import.meta.env.VITE_DEFAULT_ENGINE_INFOS ?? "[]";

  const envSchema = envEngineInfoSchema.array();
  return envSchema.parse(JSON.parse(defaultEngineInfosEnv));
}