import {
  contextBridge,
  ipcRenderer,
  IpcRenderer,
  IpcRendererEvent,
} from "electron";
import fs from "fs";
import path from "path";

import { Sandbox } from "@/type/preload";

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

  getCharacterInfos: async () => {
    return await ipcRendererInvoke("GET_CHARACTER_INFOS");
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

  getOssCommunityInfos: async () => {
    return await ipcRendererInvoke("GET_OSS_COMMUNITY_INFOS");
  },

  saveTempAudioFile: async ({ relativePath, buffer }) => {
    if (!tempDir) {
      tempDir = await ipcRendererInvoke("GET_TEMP_DIR");
    }
    fs.writeFileSync(path.join(tempDir, relativePath), new DataView(buffer));
  },

  loadTempFile: async () => {
    if (!tempDir) {
      tempDir = await ipcRendererInvoke("GET_TEMP_DIR");
    }
    const buf = fs.readFileSync(path.join(tempDir, "hoge.txt"));
    return new TextDecoder().decode(buf);
  },

  getBaseName: ({ filePath }) => {
    /**
     * filePathから拡張子を含むファイル名を取り出す。
     * vueファイルから直接pathモジュールを読み込むことは出来るが、
     * その中のbasename関数は上手く動作しない（POSIX pathとして処理される）。
     * この関数を呼び出せばWindows pathが正しく処理される。
     */
    return path.basename(filePath);
  },

  showAudioSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvoke("SHOW_AUDIO_SAVE_DIALOG", { title, defaultPath });
  },

  showOpenDirectoryDialog: ({ title }) => {
    return ipcRendererInvoke("SHOW_OPEN_DIRECTORY_DIALOG", { title });
  },

  showProjectSaveDialog: ({ title }) => {
    return ipcRendererInvoke("SHOW_PROJECT_SAVE_DIALOG", { title });
  },

  showProjectLoadDialog: ({ title }) => {
    return ipcRendererInvoke("SHOW_PROJECT_LOAD_DIALOG", { title });
  },

  showConfirmDialog: ({ title, message }) => {
    return ipcRendererInvoke("SHOW_CONFIRM_DIALOG", { title, message });
  },

  showWarningDialog: ({ title, message }) => {
    return ipcRendererInvoke("SHOW_WARNING_DIALOG", { title, message });
  },

  showErrorDialog: ({ title, message }) => {
    return ipcRendererInvoke("SHOW_ERROR_DIALOG", { title, message });
  },

  showImportFileDialog: ({ title }) => {
    return ipcRendererInvoke("SHOW_IMPORT_FILE_DIALOG", { title });
  },

  writeFile: ({ filePath, buffer }) => {
    fs.writeFileSync(filePath, new DataView(buffer));
  },

  readFile: ({ filePath }) => {
    return fs.promises.readFile(filePath);
  },

  openTextEditContextMenu: () => {
    return ipcRendererInvoke("OPEN_TEXT_EDIT_CONTEXT_MENU");
  },

  useGpu: (newValue) => {
    return ipcRendererInvoke("USE_GPU", { newValue });
  },

  inheritAudioInfo: (newValue) => {
    return ipcRendererInvoke("INHERIT_AUDIOINFO", { newValue });
  },

  isAvailableGPUMode: () => {
    return ipcRendererInvoke("IS_AVAILABLE_GPU_MODE");
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
    return ipcRenderer.invoke("LOG_ERROR", ...params);
  },

  logInfo: (...params) => {
    return ipcRenderer.invoke("LOG_INFO", ...params);
  },

  restartEngine: () => {
    return ipcRendererInvoke("RESTART_ENGINE");
  },

  savingSetting: (newData) => {
    return ipcRenderer.invoke("SAVING_SETTING", { newData });
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

  isUnsetDefaultStyleIds: async () => {
    return await ipcRendererInvoke("IS_UNSET_DEFAULT_STYLE_IDS");
  },

  getDefaultStyleIds: async () => {
    return await ipcRendererInvoke("GET_DEFAULT_STYLE_IDS");
  },

  setDefaultStyleIds: async (defaultStyleIds) => {
    await ipcRendererInvoke("SET_DEFAULT_STYLE_IDS", defaultStyleIds);
  },
};

contextBridge.exposeInMainWorld("electron", api);
