import {
  contextBridge,
  ipcRenderer,
  IpcRenderer,
  IpcRendererEvent,
} from "electron";
import fs from "fs";
import path from "path";

import { Sandbox, SystemError, ElectronStoreType } from "@/type/preload";
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

  showTextSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvoke("SHOW_TEXT_SAVE_DIALOG", { title, defaultPath });
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

  writeFile: ({ filePath, buffer }) => {
    try {
      // throwだと`.code`の情報が消えるのでreturn
      fs.writeFileSync(filePath, new DataView(buffer));
    } catch (e) {
      const a = e as SystemError;
      return { code: a.code, message: a.message };
    }

    return undefined;
  },

  readFile: ({ filePath }) => {
    return fs.promises.readFile(filePath);
  },

  openTextEditContextMenu: () => {
    return ipcRendererInvoke("OPEN_TEXT_EDIT_CONTEXT_MENU");
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

  engineInfos: () => {
    return ipcRendererInvoke("ENGINE_INFOS");
  },

  restartEngineAll: () => {
    return ipcRendererInvoke("RESTART_ENGINE_ALL");
  },

  restartEngine: (engineId: string) => {
    return ipcRendererInvoke("RESTART_ENGINE", { engineId });
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

  isUnsetDefaultStyleId: async (speakerUuid: string) => {
    return await ipcRendererInvoke("IS_UNSET_DEFAULT_STYLE_ID", speakerUuid);
  },

  getDefaultHotkeySettings: async () => {
    return await ipcRendererInvoke("GET_DEFAULT_HOTKEY_SETTINGS");
  },

  getDefaultToolbarSetting: async () => {
    return await ipcRendererInvoke("GET_DEFAULT_TOOLBAR_SETTING");
  },

  theme: (newData) => {
    return ipcRenderer.invoke("THEME", { newData });
  },

  vuexReady: () => {
    ipcRenderer.invoke("ON_VUEX_READY");
  },

  getSetting: async (key) => {
    return (await ipcRendererInvoke(
      "GET_SETTING",
      key
    )) as ElectronStoreType[typeof key];
  },

  setSetting: async (key, newValue) => {
    return (await ipcRendererInvoke(
      "SET_SETTING",
      key,
      newValue
    )) as typeof newValue;
  },
};

contextBridge.exposeInMainWorld("electron", api);
