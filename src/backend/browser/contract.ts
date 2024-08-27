import engineInfos from "@engine-infos";
import { EngineInfo } from "@/type/preload";

export const defaultEngine: EngineInfo = {
  ...engineInfos[0],
  type: "path", // FIXME: ダミーで"path"にしているので、エンジンAPIのURLを設定できるようにし、type: "URL"にする
  isDefault: true,
};
export const directoryHandleStoreKey = "directoryHandle";
