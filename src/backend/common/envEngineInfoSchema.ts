import { z } from "zod";

import { engineIdSchema } from "@/type/preload";

/** .envに書くエンジン情報のスキーマ */
export const envEngineInfoSchema = z.object({
  uuid: engineIdSchema,
  host: z.string(),
  name: z.string(),
  executionEnabled: z.boolean(),
  executionFilePath: z.string(),
  executionArgs: z.array(z.string()),
  path: z.string().optional(), // FIXME: typeがpathのときは必須
  type: z.union([z.literal("path"), z.literal("vvpp")]).default("path"),
  latestDefaultEngineInfosUrl: z.string().optional(), // FIXME: typeがvvppのときは必須
});
