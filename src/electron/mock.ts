import { get, set } from "idb-keyval";
import {
  defaultHotkeySettings,
  electronStoreSchema,
  EngineId,
  EngineInfo,
  engineSettingSchema,
  Sandbox,
  ThemeConf,
} from "@/type/preload";

declare const __availableThemes: ThemeConf[];

const storeName = "voicevox";

const engineInfos: EngineInfo[] = [
  {
    executionArgs: [],
    executionEnabled: false,
    executionFilePath: "",
    host: "http://127.0.0.1:50021",
    name: "VOICEVOX Engine",
    type: "default",
    uuid: EngineId("074fc39e-678b-4c13-8916-ffca8d505d1d"),
  },
];

const loadMock = async () => {
  const electronMock: Sandbox = {
    isMock: true,
    getAppInfos() {
      return Promise.resolve({
        name: "VOICEVOX Web",
        version: "0.0.0",
      });
    },
    getHowToUseText() {
      return Promise.resolve("# How to use\ndummy");
    },
    getPolicyText() {
      return Promise.resolve("# Policy\ndummy");
    },
    getOssLicenses() {
      return Promise.resolve([]);
    },
    getUpdateInfos() {
      return Promise.resolve([]);
    },
    getOssCommunityInfos() {
      return Promise.resolve("");
    },
    getQAndAText() {
      return Promise.resolve("# Q&A\ndummy");
    },
    getContactText() {
      return Promise.resolve("# Contact\ndummy");
    },
    getPrivacyPolicyText() {
      return Promise.resolve("# Privacy Policy\ndummy");
    },
    saveTempAudioFile(obj) {
      throw new Error(`Not implemented: saveTempAudioFile ${obj}`);
    },
    loadTempFile() {
      throw new Error("Not implemented: loadTempFile");
    },
    showAudioSaveDialog(obj) {
      throw new Error(`Not implemented: showAudioSaveDialog ${obj}`);
    },
    showTextSaveDialog(obj) {
      throw new Error(`Not implemented: showTextSaveDialog ${obj}`);
    },
    showVvppOpenDialog(obj) {
      throw new Error(`Not implemented: showVvppOpenDialog ${obj}`);
    },
    showOpenDirectoryDialog(obj) {
      throw new Error(`Not implemented: showOpenDirectoryDialog ${obj}`);
    },
    showProjectSaveDialog(obj) {
      throw new Error(`Not implemented: showProjectSaveDialog ${obj}`);
    },
    showProjectLoadDialog(obj) {
      throw new Error(`Not implemented: showProjectLoadDialog ${obj}`);
    },
    showMessageDialog(obj) {
      throw new Error(`Not implemented: showMessageDialog ${obj}`);
    },
    showQuestionDialog(obj) {
      throw new Error(`Not implemented: showQuestionDialog ${obj}`);
    },
    showImportFileDialog(obj) {
      throw new Error(`Not implemented: showImportFileDialog ${obj}`);
    },
    writeFile(obj) {
      throw new Error(`Not implemented: writeFile ${obj}`);
    },
    readFile(obj) {
      throw new Error(`Not implemented: readFile ${obj}`);
    },
    openTextEditContextMenu() {
      throw new Error("Not implemented: openTextEditContextMenu");
    },
    isAvailableGPUMode() {
      return Promise.resolve(false);
    },
    isMaximizedWindow() {
      return Promise.resolve(false);
    },
    onReceivedIPCMsg(channel, listener) {
      window.addEventListener("message", (event) => {
        if (event.data.channel === channel) {
          listener(event.data.args);
        }
      });
    },
    closeWindow() {
      throw new Error("Not implemented: closeWindow");
    },
    minimizeWindow() {
      throw new Error("Not implemented: minimizeWindow");
    },
    maximizeWindow() {
      throw new Error("Not implemented: maximizeWindow");
    },
    logError(...params) {
      console.error(...params);
    },
    logWarn(...params) {
      console.warn(...params);
    },
    logInfo(...params) {
      console.info(...params);
    },
    engineInfos() {
      return Promise.resolve(engineInfos);
    },
    restartEngine(engineId) {
      throw new Error(`Not implemented: restartEngine ${engineId}`);
    },
    openEngineDirectory(engineId) {
      throw new Error(`Not implemented: openEngineDirectory ${engineId}`);
    },
    async hotkeySettings(newData) {
      if (newData !== undefined) {
        const hotkeySettings = await this.getSetting("hotkeySettings");
        const hotkeySetting = hotkeySettings.find(
          (hotkey) => hotkey.action == newData.action
        );
        if (hotkeySetting !== undefined) {
          hotkeySetting.combination = newData.combination;
        }
        await this.setSetting("hotkeySettings", hotkeySettings);
      }
      return this.getSetting("hotkeySettings");
    },
    checkFileExists(file) {
      return Promise.resolve(false);
    },
    changePinWindow() {
      throw new Error("Not implemented: changePinWindow");
    },
    getDefaultHotkeySettings() {
      return Promise.resolve(defaultHotkeySettings);
    },
    getDefaultToolbarSetting() {
      return Promise.resolve(this.getDefaultToolbarSetting());
    },
    setNativeTheme(source) {
      const resolvedSource =
        source === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : source;

      document
        .querySelector("meta[name=theme-color]")
        ?.setAttribute(
          "content",
          resolvedSource === "dark" ? "#1f1f1f" : "#a5d4ad"
        );
    },
    async theme(newData) {
      if (newData) {
        this.setSetting("currentTheme", newData);
        return;
      }
      return {
        currentTheme: await this.getSetting("currentTheme"),
        availableThemes: __availableThemes,
      };
    },
    vuexReady() {
      console.log("vuexReady");
    },
    async getSetting(key) {
      const setting = electronStoreSchema.parse(await get(storeName));
      return Promise.resolve(setting[key]);
    },
    async setSetting(key, newValue) {
      const setting = electronStoreSchema.parse(await get(storeName));
      setting[key] = newValue;
      set("voicevox", setting);
      return setting[key];
    },
    async setEngineSetting(engineId, engineSetting) {
      await this.setSetting("engineSettings", {
        ...this.getSetting("engineSettings"),
        [engineId]: engineSetting,
      });
      return;
    },
    installVvppEngine(path) {
      throw new Error(`Not implemented: installVvppEngine ${path}`);
    },
    uninstallVvppEngine(engineId) {
      throw new Error(`Not implemented: uninstallVvppEngine ${engineId}`);
    },
    validateEngineDir(engineDir) {
      throw new Error(`Not implemented: validateEngineDir ${engineDir}`);
    },
    restartApp(obj) {
      window.location.reload();
    },
  };

  try {
    set(storeName, electronStoreSchema.parse(await get(storeName)));
  } catch (e) {
    console.error(e);
    set(storeName, electronStoreSchema.parse({}));
  }

  const engineSettings = await electronMock.getSetting("engineSettings");
  for (const engineInfo of engineInfos) {
    if (!engineSettings[engineInfo.uuid]) {
      // 空オブジェクトをパースさせることで、デフォルト値を取得する
      engineSettings[engineInfo.uuid] = engineSettingSchema.parse({});
    }
  }
  await electronMock.setSetting("engineSettings", engineSettings);

  // @ts-expect-error 仮のelectronを定義
  window.electron = electronMock;
};

export default loadMock;
