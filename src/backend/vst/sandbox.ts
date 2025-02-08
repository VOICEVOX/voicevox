import { getConfigManager } from "./vstConfig";
import {
  getProject,
  getProjectName,
  getVersion,
  readFile,
  startEngine,
  setProject,
  showImportFileDialog,
  zoom,
  writeFile,
  showExportFileDialog,
  showSaveDirectoryDialog,
  checkFileExists,
  logInfo,
  logWarn,
  logError,
  onReceivedIPCMessage,
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

export const projectFilePath = "/dev/vst-project.vvproj";

let zoomValue = 1;

let engineInfoPromise: Promise<EngineInfo[]> | undefined;

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
    if (!engineInfoPromise) {
      const { promise, resolve } = Promise.withResolvers<EngineInfo[]>();
      // エンジンが準備完了したときの処理
      onReceivedIPCMessage("engineReady", ({ port }: { port: number }) => {
        const baseEngineInfo = loadEnvEngineInfos()[0];
        if (baseEngineInfo.type != "path") {
          throw new Error("default engine type must be path");
        }
        resolve([
          {
            ...baseEngineInfo,
            protocol: "http://",
            hostname: "localhost",
            defaultPort: port.toString(),
            pathname: "",
            type: "path",
            isDefault: true,
          },
        ]);
      });
      engineInfoPromise = promise;
    }

    return engineInfoPromise;
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
  showImportFileDialog(options) {
    return showImportFileDialog(options);
  },
  async checkFileExists(file) {
    return await checkFileExists(file);
  },
  async writeFile(options) {
    if (options.filePath === projectFilePath) {
      await setProject(new TextDecoder().decode(options.buffer));
      return success(undefined);
    }

    try {
      await writeFile(options.filePath, options.buffer);
      return success(undefined);
    } catch (e) {
      return failure(e as Error);
    }
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
  async showExportFileDialog(obj) {
    return await showExportFileDialog(obj);
  },
  async showSaveDirectoryDialog(obj) {
    return await showSaveDirectoryDialog(obj);
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

  async zoomIn() {
    zoomValue = Math.min(Math.max(zoomValue + 0.1, 0.5), 3);
    await zoom(zoomValue);
  },
  async zoomOut() {
    zoomValue = Math.min(Math.max(zoomValue - 0.1, 0.5), 3);
    await zoom(zoomValue);
  },
  async zoomReset() {
    zoomValue = 1;
    await zoom(zoomValue);
  },

  logInfo(...params) {
    logInfo(params.map(String).join(" "));
  },

  logWarn(...params) {
    logWarn(params.map(String).join(" "));
  },

  logError(...params) {
    logError(params.map(String).join(" "));
  },
};
