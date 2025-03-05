import { contextBridge, ipcRenderer, webUtils } from "electron";
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
  getTextAsset: (textType) => {
    return ipcRendererInvokeProxy.GET_TEXT_ASSET(textType) as Promise<
      TextAsset[typeof textType]
    >;
  },

  getAltPortInfos: async () => {
    return await ipcRendererInvokeProxy.GET_ALT_PORT_INFOS();
  },

  getInitialProjectFilePath: async () => {
    return await ipcRendererInvokeProxy.GET_INITIAL_PROJECT_FILE_PATH();
  },

  showSaveDirectoryDialog: ({ title }) => {
    return ipcRendererInvokeProxy.SHOW_SAVE_DIRECTORY_DIALOG({ title });
  },

  showOpenDirectoryDialog: ({ title }) => {
    return ipcRendererInvokeProxy.SHOW_OPEN_DIRECTORY_DIALOG({ title });
  },

  showOpenFileDialog: ({ title, name, extensions, defaultPath }) => {
    return ipcRendererInvokeProxy.SHOW_OPEN_FILE_DIALOG({
      title,
      name,
      extensions,
      defaultPath,
    });
  },

  showSaveFileDialog: ({ title, name, extensions, defaultPath }) => {
    return ipcRendererInvokeProxy.SHOW_SAVE_FILE_DIALOG({
      title,
      name,
      extensions,
      defaultPath,
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

  toggleMaximizeWindow: () => {
    void ipcRendererInvokeProxy.TOGGLE_MAXIMIZE_WINDOW();
  },

  toggleFullScreen: () => {
    void ipcRendererInvokeProxy.TOGGLE_FULLSCREEN();
  },

  zoomIn: () => {
    void ipcRendererInvokeProxy.ZOOM_IN();
  },
  zoomOut: () => {
    void ipcRendererInvokeProxy.ZOOM_OUT();
  },
  zoomReset: () => {
    void ipcRendererInvokeProxy.ZOOM_RESET();
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

  /** webUtils.getPathForFileを呼ぶ */
  getPathForFile: (file) => {
    return webUtils.getPathForFile(file);
  },
};

contextBridge.exposeInMainWorld(SandboxKey, api);
