import { getConfigManager } from "./vstConfig";
import {
  getProject,
  getProjectName,
  getVersion,
  readFile,
  startEngine,
  setProject,
  showImportFileDialog,
} from "./ipc";
import {
  EngineId,
  EngineInfo,
  EngineSettingType,
  EngineSettings,
  Sandbox,
} from "@/type/preload";
import { api as browserSandbox } from "@/backend/browser/sandbox";
import { failure, success } from "@/type/result";
import { loadEnvEngineInfos } from "@/domain/defaultEngine/envEngineInfo";
import { UnreachableError } from "@/type/utility";

export const projectFilePath = "/meta/vst-project.vvproj";

/**
 * VST版のSandBox実装
 * ブラウザ版のSandBoxを継承している
 */
export const api: Sandbox = {
  ...browserSandbox,
  async getAppInfos() {
    const appInfo = {
      name: await getProjectName(),
      version: await getVersion(),
    };
    return appInfo;
  },
  async engineInfos() {
    const state = new URLSearchParams(window.location.search);
    const status = state.get("engineStatus");
    const baseEngineInfo = loadEnvEngineInfos()[0];
    if (baseEngineInfo.type != "path") {
      throw new Error("default engine type must be path");
    }
    if (status === "ready") {
      const port = state.get("port");
      if (!port) {
        throw new Error("port is not found");
      }

      const { protocol, hostname, pathname } = new URL(baseEngineInfo.host);
      return [
        {
          ...baseEngineInfo,
          protocol,
          hostname,
          defaultPort: port,
          pathname: pathname === "/" ? "" : pathname,
          type: "path",
          isDefault: true,
        } satisfies EngineInfo,
      ];
    } else {
      // 「エンジン起動中...」を出すため、常に失敗するエンジン情報を返す。
      // TODO: もっと良い方法を考える
      return [
        {
          ...baseEngineInfo,
          type: "path",
          protocol: "http://",
          hostname: "voicevox-always-fail.internal",
          defaultPort: "0",
          pathname: "/",
          isDefault: true,
        },
      ];
    }
  },
  async restartEngine(engineId) {
    const engineInfos = await this.engineInfos();
    if (engineInfos.length === 0) {
      throw new Error("No engine info found");
    }
    if (engineId !== engineInfos[0].uuid) {
      // とりあえずマルチエンジンはサポートしない
      throw new Error(`Invalid engineId: ${engineId}`);
    }
    const engineSettings = await this.getSetting("engineSettings");
    const engineSetting = engineSettings[engineId];
    if (!engineSetting) {
      throw new UnreachableError(`unreachable: engineSetting is not found`);
    }
    await startEngine({ useGpu: engineSetting.useGpu, forceRestart: true });
  },
  async showProjectLoadDialog({ title }) {
    const filePath = await window.backend.showImportFileDialog({
      title,
      name: "VOICEVOX Project file",
      extensions: ["vvproj"],
    });
    return filePath ? [filePath] : undefined;
  },
  showImportFileDialog(options) {
    return showImportFileDialog(options);
  },
  async writeFile(options) {
    if (options.filePath === projectFilePath) {
      await setProject(new TextDecoder().decode(options.buffer));
      return success(undefined);
    }
    throw new Error("Not implemented");
  },
  async readFile(options) {
    if (options.filePath === projectFilePath) {
      const project = await getProject();
      const buffer = new TextEncoder().encode(project);
      return success(buffer);
    } else {
      try {
        return success(await readFile(options.filePath));
      } catch (e) {
        return failure(e as Error);
      }
    }
  },
  async getSetting(key) {
    const configManager = await getConfigManager();
    return configManager.get(key);
  },
  async setSetting(key, newValue) {
    const configManager = await getConfigManager();
    configManager.set(key, newValue);
    return newValue;
  },
  async setEngineSetting(engineId: EngineId, engineSetting: EngineSettingType) {
    const engineSettings = (await this.getSetting(
      "engineSettings",
    )) as EngineSettings;
    engineSettings[engineId] = engineSetting;
    await this.setSetting("engineSettings", engineSettings);
    return;
  },
};
