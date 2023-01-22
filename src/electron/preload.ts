import {
  contextBridge,
  ipcRenderer,
  IpcRenderer,
  IpcRendererEvent,
} from "electron";

import { Sandbox, ElectronStoreType } from "@/type/preload";
import { IpcIHData, IpcSOData } from "@/type/ipc";

function ipcRendererInvoke<T extends keyof IpcIHData>(
  channel: T,
  ...args: IpcIHData[T]["args"]
): Promise<IpcIHData[T]["return"]>;
function ipcRendererInvoke(channel: string, ...args: unknown[]): unknown {
  return ipcRenderer.invoke(channel, ...args);
}

function ipcRendererOn<T extends keyof IpcSOData>(
  channel: T,
  listener: (event: IpcRendererEvent, ...args: IpcSOData[T]["args"]) => void
): IpcRenderer;
function ipcRendererOn(
  channel: string,
  listener: (event: IpcRendererEvent, ...args: unknown[]) => void
) {
  return ipcRenderer.on(channel, listener);
}

let tempDir: string;

const api: Sandbox = {
  getAppInfos: async () => {
    return await ipcRendererInvoke("GET_APP_INFOS");
  },

  getHowToUseText: async () => {
    return await ipcRendererInvoke("GET_HOW_TO_USE_TEXT");
  },

  getPolicyText: async () => {
    return await ipcRendererInvoke("GET_POLICY_TEXT");
  },

  getOssLicenses: async () => {
    return await ipcRendererInvoke("GET_OSS_LICENSES");
  },

  getUpdateInfos: async () => {
    return await ipcRendererInvoke("GET_UPDATE_INFOS");
  },

  getContactText: async () => {
    return await ipcRendererInvoke("GET_CONTACT_TEXT");
  },

  getQAndAText: async () => {
    return await ipcRendererInvoke("GET_Q_AND_A_TEXT");
  },

  getOssCommunityInfos: async () => {
    return await ipcRendererInvoke("GET_OSS_COMMUNITY_INFOS");
  },

  getPrivacyPolicyText: async () => {
    return await ipcRendererInvoke("GET_PRIVACY_POLICY_TEXT");
  },

  saveTempAudioFile: async ({ relativePath, buffer }) => {
    if (!tempDir) {
      tempDir = await ipcRendererInvoke("GET_TEMP_DIR");
    }
    const tempFilePath = await ipcRendererInvoke("JOIN_PATH", {
      pathArray: [tempDir, relativePath],
    });
    await ipcRendererInvoke("WRITE_FILE", {
      filePath: tempFilePath,
      buffer: buffer,
    });
  },

  loadTempFile: async () => {
    if (!tempDir) {
      tempDir = await ipcRendererInvoke("GET_TEMP_DIR");
    }
    const tempFilePath = await ipcRendererInvoke("JOIN_PATH", {
      pathArray: [tempDir, "hoge.txt"],
    });
    const buf = await ipcRendererInvoke("READ_FILE", {
      filePath: tempFilePath,
    });
    return new TextDecoder().decode(buf);
  },

  showAudioSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvoke("SHOW_AUDIO_SAVE_DIALOG", { title, defaultPath });
  },

  showTextSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvoke("SHOW_TEXT_SAVE_DIALOG", { title, defaultPath });
  },

  showVvppOpenDialog: ({ title, defaultPath }) => {
    return ipcRendererInvoke("SHOW_VVPP_OPEN_DIALOG", { title, defaultPath });
  },

  showOpenDirectoryDialog: ({ title }) => {
    return ipcRendererInvoke("SHOW_OPEN_DIRECTORY_DIALOG", { title });
  },

  showProjectSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvoke("SHOW_PROJECT_SAVE_DIALOG", {
      title,
      defaultPath,
    });
  },

  showProjectLoadDialog: ({ title }) => {
    return ipcRendererInvoke("SHOW_PROJECT_LOAD_DIALOG", { title });
  },

  showMessageDialog: ({ type, title, message }) => {
    return ipcRendererInvoke("SHOW_MESSAGE_DIALOG", { type, title, message });
  },

  showQuestionDialog: ({ type, title, message, buttons, cancelId }) => {
    return ipcRendererInvoke("SHOW_QUESTION_DIALOG", {
      type,
      title,
      message,
      buttons,
      cancelId,
    });
  },

  showImportFileDialog: ({ title }) => {
    return ipcRendererInvoke("SHOW_IMPORT_FILE_DIALOG", { title });
  },

  writeFile: async ({ filePath, buffer }) => {
    return await ipcRendererInvoke("WRITE_FILE", { filePath, buffer });
  },

  readFile: async ({ filePath }) => {
    return await ipcRendererInvoke("READ_FILE", { filePath });
  },

  openTextEditContextMenu: () => {
    return ipcRendererInvoke("OPEN_TEXT_EDIT_CONTEXT_MENU");
  },

  isAvailableGPUMode: () => {
    return ipcRendererInvoke("IS_AVAILABLE_GPU_MODE");
  },

  isMaximizedWindow: () => {
    return ipcRendererInvoke("IS_MAXIMIZED_WINDOW");
  },

  onReceivedIPCMsg: (channel, callback) => {
    return ipcRendererOn(channel, callback);
  },

  closeWindow: () => {
    ipcRenderer.invoke("CLOSE_WINDOW");
  },

  minimizeWindow: () => {
    ipcRenderer.invoke("MINIMIZE_WINDOW");
  },

  maximizeWindow: () => {
    ipcRenderer.invoke("MAXIMIZE_WINDOW");
  },

  logError: (...params) => {
    console.error(...params);
    return ipcRenderer.invoke("LOG_ERROR", ...params);
  },

  logWarn: (...params) => {
    console.warn(...params);
    return ipcRenderer.invoke("LOG_WARN", ...params);
  },

  logInfo: (...params) => {
    console.info(...params);
    return ipcRenderer.invoke("LOG_INFO", ...params);
  },

  engineInfos: () => {
    return ipcRendererInvoke("ENGINE_INFOS");
  },

  restartEngine: (engineId: string) => {
    return ipcRendererInvoke("RESTART_ENGINE", { engineId });
  },

  openEngineDirectory: (engineId: string) => {
    return ipcRendererInvoke("OPEN_ENGINE_DIRECTORY", { engineId });
  },

  checkFileExists: (file) => {
    return ipcRenderer.invoke("CHECK_FILE_EXISTS", { file });
  },

  changePinWindow: () => {
    ipcRenderer.invoke("CHANGE_PIN_WINDOW");
  },

  hotkeySettings: (newData) => {
    return ipcRenderer.invoke("HOTKEY_SETTINGS", { newData });
  },

  getDefaultHotkeySettings: async () => {
    return await ipcRendererInvoke("GET_DEFAULT_HOTKEY_SETTINGS");
  },

  getDefaultToolbarSetting: async () => {
    return await ipcRendererInvoke("GET_DEFAULT_TOOLBAR_SETTING");
  },

  setNativeTheme: (source) => {
    ipcRenderer.invoke("SET_NATIVE_THEME", source);
  },

  theme: (newData) => {
    return ipcRenderer.invoke("THEME", newData);
  },

  vuexReady: () => {
    ipcRenderer.invoke("ON_VUEX_READY");
  },

  /**
   * 設定情報を取得する
   */
  getSetting: async (key) => {
    return (await ipcRendererInvoke(
      "GET_SETTING",
      key
    )) as ElectronStoreType[typeof key];
  },

  /**
   * 設定情報を保存する
   */
  setSetting: async (key, newValue) => {
    return (await ipcRendererInvoke(
      "SET_SETTING",
      key,
      newValue
    )) as typeof newValue;
  },

  installVvppEngine: async (filePath) => {
    return await ipcRendererInvoke("INSTALL_VVPP_ENGINE", filePath);
  },

  uninstallVvppEngine: async (engineId) => {
    return await ipcRendererInvoke("UNINSTALL_VVPP_ENGINE", engineId);
  },

  validateEngineDir: async (engineDir) => {
    return await ipcRendererInvoke("VALIDATE_ENGINE_DIR", { engineDir });
  },

  restartApp: ({ isSafeMode }: { isSafeMode: boolean }) => {
    ipcRendererInvoke("RESTART_APP", { isSafeMode });
  },
};

contextBridge.exposeInMainWorld("electron", api);
