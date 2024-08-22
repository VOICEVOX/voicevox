import { contextBridge, ipcRenderer } from "electron";

import { Sandbox, ConfigType, EngineId, SandboxKey } from "@/type/preload";
import { IpcRendererInvoke } from "@/type/ipc";

const ipcRendererInvoke = new Proxy({} as IpcRendererInvoke, {
  get:
    (_, channel: string) =>
    (...args: unknown[]) =>
      ipcRenderer.invoke(channel, ...args),
});

const api: Sandbox = {
  getAppInfos: async () => {
    return await ipcRendererInvoke.GET_APP_INFOS();
  },

  getHowToUseText: async () => {
    return await ipcRendererInvoke.GET_HOW_TO_USE_TEXT();
  },

  getPolicyText: async () => {
    return await ipcRendererInvoke.GET_POLICY_TEXT();
  },

  getOssLicenses: async () => {
    return await ipcRendererInvoke.GET_OSS_LICENSES();
  },

  getUpdateInfos: async () => {
    return await ipcRendererInvoke.GET_UPDATE_INFOS();
  },

  getContactText: async () => {
    return await ipcRendererInvoke.GET_CONTACT_TEXT();
  },

  getQAndAText: async () => {
    return await ipcRendererInvoke.GET_Q_AND_A_TEXT();
  },

  getOssCommunityInfos: async () => {
    return await ipcRendererInvoke.GET_OSS_COMMUNITY_INFOS();
  },

  getPrivacyPolicyText: async () => {
    return await ipcRendererInvoke.GET_PRIVACY_POLICY_TEXT();
  },

  getAltPortInfos: async () => {
    return await ipcRendererInvoke.GET_ALT_PORT_INFOS();
  },

  showAudioSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvoke.SHOW_AUDIO_SAVE_DIALOG({ title, defaultPath });
  },

  showTextSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvoke.SHOW_TEXT_SAVE_DIALOG({ title, defaultPath });
  },

  showSaveDirectoryDialog: ({ title }) => {
    return ipcRendererInvoke.SHOW_SAVE_DIRECTORY_DIALOG({ title });
  },

  showVvppOpenDialog: ({ title, defaultPath }) => {
    return ipcRendererInvoke.SHOW_VVPP_OPEN_DIALOG({ title, defaultPath });
  },

  showOpenDirectoryDialog: ({ title }) => {
    return ipcRendererInvoke.SHOW_OPEN_DIRECTORY_DIALOG({ title });
  },

  showProjectSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvoke.SHOW_PROJECT_SAVE_DIALOG({
      title,
      defaultPath,
    });
  },

  showProjectLoadDialog: ({ title }) => {
    return ipcRendererInvoke.SHOW_PROJECT_LOAD_DIALOG({ title });
  },

  showMessageDialog: ({ type, title, message }) => {
    return ipcRendererInvoke.SHOW_MESSAGE_DIALOG({ type, title, message });
  },

  showQuestionDialog: ({
    type,
    title,
    message,
    buttons,
    cancelId,
    defaultId,
  }) => {
    return ipcRendererInvoke.SHOW_QUESTION_DIALOG({
      type,
      title,
      message,
      buttons,
      cancelId,
      defaultId,
    });
  },

  showImportFileDialog: ({ title, name, extensions }) => {
    return ipcRendererInvoke.SHOW_IMPORT_FILE_DIALOG({
      title,
      name,
      extensions,
    });
  },

  writeFile: async ({ filePath, buffer }) => {
    return await ipcRendererInvoke.WRITE_FILE({ filePath, buffer });
  },

  readFile: async ({ filePath }) => {
    return await ipcRendererInvoke.READ_FILE({ filePath });
  },

  isAvailableGPUMode: () => {
    return ipcRendererInvoke.IS_AVAILABLE_GPU_MODE();
  },

  isMaximizedWindow: () => {
    return ipcRendererInvoke.IS_MAXIMIZED_WINDOW();
  },

  onReceivedIPCMsg: (listeners) => {
    Object.entries(listeners).forEach(([channel, listener]) => {
      ipcRenderer.on(channel, listener);
    });
  },

  closeWindow: () => {
    void ipcRendererInvoke.CLOSE_WINDOW();
  },

  minimizeWindow: () => {
    void ipcRendererInvoke.MINIMIZE_WINDOW();
  },

  maximizeWindow: () => {
    void ipcRendererInvoke.MAXIMIZE_WINDOW();
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
    void ipcRendererInvoke.OPEN_LOG_DIRECTORY();
  },

  engineInfos: () => {
    return ipcRendererInvoke.ENGINE_INFOS();
  },

  restartEngine: (engineId: EngineId) => {
    return ipcRendererInvoke.RESTART_ENGINE({ engineId });
  },

  openEngineDirectory: (engineId: EngineId) => {
    return ipcRendererInvoke.OPEN_ENGINE_DIRECTORY({ engineId });
  },

  checkFileExists: (file) => {
    return ipcRendererInvoke.CHECK_FILE_EXISTS({ file });
  },

  changePinWindow: () => {
    void ipcRendererInvoke.CHANGE_PIN_WINDOW();
  },

  hotkeySettings: (newData) => {
    return ipcRendererInvoke.HOTKEY_SETTINGS({ newData });
  },

  getDefaultHotkeySettings: async () => {
    return await ipcRendererInvoke.GET_DEFAULT_HOTKEY_SETTINGS();
  },

  getDefaultToolbarSetting: async () => {
    return await ipcRendererInvoke.GET_DEFAULT_TOOLBAR_SETTING();
  },

  setNativeTheme: (source) => {
    void ipcRendererInvoke.SET_NATIVE_THEME(source);
  },

  theme: (newData) => {
    return ipcRendererInvoke.THEME({ newData });
  },

  vuexReady: () => {
    void ipcRendererInvoke.ON_VUEX_READY();
  },

  /**
   * 設定情報を取得する
   */
  getSetting: async (key) => {
    return (await ipcRendererInvoke.GET_SETTING(key)) as ConfigType[typeof key];
  },

  /**
   * 設定情報を保存する
   */
  setSetting: async (key, newValue) => {
    return (await ipcRendererInvoke.SET_SETTING(
      key,
      newValue,
    )) as typeof newValue;
  },

  setEngineSetting: async (engineId, engineSetting) => {
    await ipcRendererInvoke.SET_ENGINE_SETTING(engineId, engineSetting);
  },

  installVvppEngine: async (filePath) => {
    return await ipcRendererInvoke.INSTALL_VVPP_ENGINE(filePath);
  },

  uninstallVvppEngine: async (engineId) => {
    return await ipcRendererInvoke.UNINSTALL_VVPP_ENGINE(engineId);
  },

  validateEngineDir: async (engineDir) => {
    return await ipcRendererInvoke.VALIDATE_ENGINE_DIR({ engineDir });
  },

  /**
   * アプリを再読み込みする。
   * 画面以外の情報を刷新する。
   */
  reloadApp: async ({ isMultiEngineOffMode }) => {
    await ipcRendererInvoke.RELOAD_APP({ isMultiEngineOffMode });
  },
};

contextBridge.exposeInMainWorld(SandboxKey, api);
