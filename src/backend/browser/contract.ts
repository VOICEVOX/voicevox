import { loadEnvEngineInfos } from "@/domain/defaultEngine/envEngineInfo";
import { type EngineInfo } from "@/type/preload";

const baseEngineInfo = loadEnvEngineInfos()[0];
if (baseEngineInfo.type != "path") {
  throw new Error("default engine type must be path");
}

export const defaultEngine: EngineInfo = (() => {
  const { protocol, hostname, port, pathname } = new URL(baseEngineInfo.host);
  return {
    ...baseEngineInfo,
    protocol,
    hostname,
    defaultPort: port,
    pathname: pathname === "/" ? "" : pathname,
    type: "path", // FIXME: ダミーで"path"にしているので、エンジンAPIのURLを設定できるようにし、type: "URL"にする
    isDefault: true,
  };
})();
export const directoryHandleStoreKey = "directoryHandle";
