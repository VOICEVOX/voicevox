import { type EngineInfo, envEngineInfoSchema } from "@/type/preload";

const baseEngineInfo = envEngineInfoSchema
  .array()
  .parse(JSON.parse(import.meta.env.VITE_DEFAULT_ENGINE_INFOS))[0];

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
