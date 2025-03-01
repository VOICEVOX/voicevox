import { toBytes } from "fast-base64";
import { getConfigManager } from "./vstConfig";
import {
  getProject,
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
  openLogDirectory,
  openEngineDirectory,
  getCachedVoice,
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

export const internalProjectFilePath = "/dev/vst-project.vvproj";

class UnimplementedError extends Error {
  constructor() {
    super("Function not implemented.");
  }
}

let zoomValue = 1;

let engineInfoPromise: Promise<EngineInfo[]> | undefined;

/**
 * VST版のSandBox実装
 * ブラウザ版のSandBoxを継承している
 */
export const api: Sandbox = {
  // ブラウザ版を使い回す
  getTextAsset(key) {
    return browserSandbox.getTextAsset(key);
  },

  getAltPortInfos() {
    return browserSandbox.getAltPortInfos();
  },

  async getInitialProjectFilePath() {
    const projectExists = await getProject();

    return projectExists ? internalProjectFilePath : undefined;
  },

  async showSaveDirectoryDialog(obj) {
    return await showSaveDirectoryDialog(obj);
  },

  showOpenFileDialog(options) {
    return showImportFileDialog(options);
  },

  async showSaveFileDialog(obj) {
    return await showExportFileDialog({
      extensionName: obj.name,
      extensions: obj.extensions,
      title: obj.title,
      defaultPath: obj.defaultPath,
    });
  },

  async writeFile(options) {
    if (options.filePath === internalProjectFilePath) {
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
    if (options.filePath === internalProjectFilePath) {
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

  isAvailableGPUMode(): Promise<boolean> {
    // TODO: Rust側でちゃんと実装する
    return Promise.resolve(true);
  },

  onReceivedIPCMsg(listeners) {
    return browserSandbox.onReceivedIPCMsg(listeners);
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

  openLogDirectory() {
    void openLogDirectory();
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

  openEngineDirectory() {
    void openEngineDirectory();
  },

  setNativeTheme() {
    // なにもしない。
  },

  vuexReady() {
    return browserSandbox.vuexReady();
  },

  async checkFileExists(file) {
    return await checkFileExists(file);
  },

  getDefaultToolbarSetting() {
    return browserSandbox.getDefaultToolbarSetting();
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

  isMaximizedWindow() {
    // 表示だけなのでとりあえずfalseを返す
    return Promise.resolve(false);
  },

  hotkeySettings(data) {
    return browserSandbox.hotkeySettings.bind(this)(data);
  },

  async fetchCachedSingingVoice(key) {
    // キャッシュされた歌声を読み込む。
    const encodedVoice = await getCachedVoice(key);
    if (!encodedVoice) {
      return undefined;
    }
    return new Blob([await toBytes(encodedVoice)]);
  },

  // 未実装
  showOpenDirectoryDialog() {
    // エンジン管理で使っている。VST版では使わないので未実装
    throw new UnimplementedError();
  },

  closeWindow() {
    throw new UnimplementedError();
  },

  minimizeWindow() {
    throw new UnimplementedError();
  },

  changePinWindow() {
    throw new UnimplementedError();
  },

  toggleMaximizeWindow() {
    throw new UnimplementedError();
  },

  toggleFullScreen() {
    throw new UnimplementedError();
  },

  installVvppEngine() {
    throw new UnimplementedError();
  },

  uninstallVvppEngine() {
    throw new UnimplementedError();
  },

  validateEngineDir() {
    throw new UnimplementedError();
  },

  reloadApp() {
    throw new UnimplementedError();
  },

  getPathForFile() {
    throw new UnimplementedError();
  },
};
