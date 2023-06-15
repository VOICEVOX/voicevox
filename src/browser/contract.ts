import { EngineInfo, EngineId } from "@/type/preload";

export const defaultEngine: EngineInfo = {
  uuid: EngineId("074fc39e-678b-4c13-8916-ffca8d505d1d"),
  host: "http://127.0.0.1:50021",
  name: "VOICEVOX Engine",
  path: undefined,
  executionEnabled: false,
  executionFilePath: "",
  executionArgs: [],
  type: "default",
};

export const directoryHandlerStoreKey = "directoryHandler";
