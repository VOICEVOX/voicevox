import { z } from "zod";
import { engineIdSchema } from "@/type/preload";

// デフォルトエンジン情報
export const defaultEngineInfosEnvSchema = z
  .object({
    uuid: engineIdSchema,
    host: z.string(),
    name: z.string(),
    executionEnabled: z.boolean(),
    executionFilePath: z.string(),
    executionArgs: z.array(z.string()),
    path: z.string().optional(),
  })
  .array();
