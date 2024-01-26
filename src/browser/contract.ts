import { EngineInfo, envEngineInfoSchema } from "@/type/preload";

const baseEngineInfo = envEngineInfoSchema
  .array()
  .parse(JSON.parse(import.meta.env.VITE_DEFAULT_ENGINE_INFOS))[0];

export const defaultEngine: EngineInfo = {
  ...baseEngineInfo,
  type: "default",
};
export const directoryHandleStoreKey = "directoryHandle";
