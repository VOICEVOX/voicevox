import { loadEnvEngineInfos } from "../common/envEngineInfoSchema";
import { EngineInfo } from "@/type/preload";

const baseEngineInfo = loadEnvEngineInfos()[0];

export const defaultEngine: EngineInfo = {
  ...baseEngineInfo,
  type: "path", // FIXME: ダミーで"path"にしているので、エンジンAPIのURLを設定できるようにし、type: "URL"にする
  isDefault: true,
};
export const directoryHandleStoreKey = "directoryHandle";
