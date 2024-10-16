import { getConfigManager } from "./vstConfig";
import {
  getProject,
  getProjectName,
  getVersion,
  readFile,
  setProject,
  showImportFileDialog,
} from "./ipc";
import {
  EngineId,
  EngineSettingType,
  EngineSettings,
  Sandbox,
} from "@/type/preload";
import { api as browserSandbox } from "@/backend/browser/sandbox";
import { failure, success } from "@/type/result";

export const projectFilePath = "/meta/vst-project.vvproj";

/**
 * VST版のSandBox実装
 * src/type/preload.tsのSandboxを変更した場合は、interfaceに追従した変更が必要
 * まだ開発中のため、VST版の実装も同時に行えない場合は、メソッドを追加して throw new Error() する
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
