import { BRAND } from "zod";

export type EngineId = string & BRAND<"EngineId">;

export interface DefaultEngineInfo {
  uuid: EngineId;
  name: string;
  path?: string;
  executionEnabled: boolean;
  executionFilePath: string;
  executionArgs: string[];
  host: string;
}

export type DefaultEngineInfos = DefaultEngineInfo[];

declare const engineInfos: DefaultEngineInfos;
export default engineInfos;
