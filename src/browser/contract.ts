import { EngineInfo, envEngineInfoSchema } from "@/type/preload";

export const engineInfos: EngineInfo[] = envEngineInfoSchema
  .array()
  .parse(JSON.parse(import.meta.env.VITE_DEFAULT_ENGINE_INFOS))
  .map((v) => ({
    ...v,
    type: "default",
  }));

export const directoryHandleStoreKey = "directoryHandle";
