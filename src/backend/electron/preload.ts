import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererInvoke } from "./ipc";
import {
  ConfigType,
  EngineId,
  Sandbox,
  SandboxKey,
  TextAsset,
} from "@/type/preload";

const ipcRendererInvokeProxy = new Proxy(
  {},
  {
    get:
      (_, channel: string) =>
      (...args: unknown[]) =>
        ipcRenderer.invoke(channel, ...args),
  },
) as IpcRendererInvoke;

const api: Sandbox = {
  getAppInfos: async () => {
    return await ipcRendererInvokeProxy.GET_APP_INFOS();
  },

  getTextAsset: (textType) => {
    return ipcRendererInvokeProxy.GET_TEXT_ASSET(textType) as Promise<
      TextAsset[typeof textType]
    >;
  },

  getAltPortInfos: async () => {
    return await ipcRendererInvokeProxy.GET_ALT_PORT_INFOS();
  },

  showAudioSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvokeProxy.SHOW_AUDIO_SAVE_DIALOG({
      title,
      defaultPath,
    });
  },

  showTextSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvokeProxy.SHOW_TEXT_SAVE_DIALOG({ title, defaultPath });
  },

  showSaveDirectoryDialog: ({ title }) => {
    return ipcRendererInvokeProxy.SHOW_SAVE_DIRECTORY_DIALOG({ title });
  },

  showVvppOpenDialog: ({ title, defaultPath }) => {
    return ipcRendererInvokeProxy.SHOW_VVPP_OPEN_DIALOG({ title, defaultPath });
  },

  showOpenDirectoryDialog: ({ title }) => {
    return ipcRendererInvokeProxy.SHOW_OPEN_DIRECTORY_DIALOG({ title });
  },

  showProjectSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvokeProxy.SHOW_PROJECT_SAVE_DIALOG({
      title,
      defaultPath,
    });
  },

  showProjectLoadDialog: ({ title }) => {
    return ipcRendererInvokeProxy.SHOW_PROJECT_LOAD_DIALOG({ title });
  },

  showImportFileDialog: ({ title, name, extensions }) => {
    return ipcRendererInvokeProxy.SHOW_IMPORT_FILE_DIALOG({
      title,
      name,
      extensions,
    });
  },

  writeFile: async ({ filePath, buffer }) => {
    return await ipcRendererInvokeProxy.WRITE_FILE({ filePath, buffer });
  },

  readFile: async ({ filePath }) => {
    return await ipcRendererInvokeProxy.READ_FILE({ filePath });
  },

  isAvailableGPUMode: () => {
    return ipcRendererInvokeProxy.IS_AVAILABLE_GPU_MODE();
  },

  isMaximizedWindow: () => {
    return ipcRendererInvokeProxy.IS_MAXIMIZED_WINDOW();
  },

  onReceivedIPCMsg: (listeners) => {
    Object.entries(listeners).forEach(([channel, listener]) => {
      ipcRenderer.on(channel, listener);
    });
  },

  closeWindow: () => {
    void ipcRendererInvokeProxy.CLOSE_WINDOW();
  },

  minimizeWindow: () => {
    void ipcRendererInvokeProxy.MINIMIZE_WINDOW();
  },

  maximizeWindow: () => {
    void ipcRendererInvokeProxy.MAXIMIZE_WINDOW();
  },

  logError: (...params) => {
    console.error(...params);
    // 経緯 https://github.com/VOICEVOX/voicevox/pull/1620#discussion_r1371804569
    ipcRenderer.send("__ELECTRON_LOG__", {
      data: [...params],
      level: "error",
    });
  },

  logWarn: (...params) => {
    console.warn(...params);
    ipcRenderer.send("__ELECTRON_LOG__", {
      data: [...params],
      level: "warn",
    });
  },

  logInfo: (...params) => {
    console.info(...params);
    ipcRenderer.send("__ELECTRON_LOG__", {
      data: [...params],
      level: "info",
    });
  },

  openLogDirectory: () => {
    void ipcRendererInvokeProxy.OPEN_LOG_DIRECTORY();
  },

  engineInfos: () => {
    return ipcRendererInvokeProxy.ENGINE_INFOS();
  },

  restartEngine: (engineId: EngineId) => {
    return ipcRendererInvokeProxy.RESTART_ENGINE({ engineId });
  },

  openEngineDirectory: (engineId: EngineId) => {
    return ipcRendererInvokeProxy.OPEN_ENGINE_DIRECTORY({ engineId });
  },

  checkFileExists: (file) => {
    return ipcRendererInvokeProxy.CHECK_FILE_EXISTS({ file });
  },

  changePinWindow: () => {
    void ipcRendererInvokeProxy.CHANGE_PIN_WINDOW();
  },

  hotkeySettings: (newData) => {
    return ipcRendererInvokeProxy.HOTKEY_SETTINGS({ newData });
  },

  getDefaultHotkeySettings: async () => {
    return await ipcRendererInvokeProxy.GET_DEFAULT_HOTKEY_SETTINGS();
  },

  getDefaultToolbarSetting: async () => {
    return await ipcRendererInvokeProxy.GET_DEFAULT_TOOLBAR_SETTING();
  },

  setNativeTheme: (source) => {
    void ipcRendererInvokeProxy.SET_NATIVE_THEME(source);
  },

  vuexReady: () => {
    void ipcRendererInvokeProxy.ON_VUEX_READY();
  },

  /**
   * 設定情報を取得する
   */
  getSetting: async (key) => {
    return (await ipcRendererInvokeProxy.GET_SETTING(
      key,
    )) as ConfigType[typeof key];
  },

  /**
   * 設定情報を保存する
   */
  setSetting: async (key, newValue) => {
    return (await ipcRendererInvokeProxy.SET_SETTING(
      key,
      newValue,
    )) as typeof newValue;
  },

  setEngineSetting: async (engineId, engineSetting) => {
    await ipcRendererInvokeProxy.SET_ENGINE_SETTING(engineId, engineSetting);
  },

  installVvppEngine: async (filePath) => {
    return await ipcRendererInvokeProxy.INSTALL_VVPP_ENGINE(filePath);
  },

  uninstallVvppEngine: async (engineId) => {
    return await ipcRendererInvokeProxy.UNINSTALL_VVPP_ENGINE(engineId);
  },

  validateEngineDir: async (engineDir) => {
    return await ipcRendererInvokeProxy.VALIDATE_ENGINE_DIR({ engineDir });
  },

  /**
   * アプリを再読み込みする。
   * 画面以外の情報を刷新する。
   */
  reloadApp: async ({ isMultiEngineOffMode }) => {
    await ipcRendererInvokeProxy.RELOAD_APP({ isMultiEngineOffMode });
  },
};

contextBridge.exposeInMainWorld(SandboxKey, api);
