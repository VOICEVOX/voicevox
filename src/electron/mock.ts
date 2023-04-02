/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  defaultHotkeySettings,
  defaultToolbarButtonSetting,
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

const loadMock = () => {
  const electronMock: Sandbox = {
    isMock: true,
    async getAppInfos() {
      return {
        name: "VOICEVOX Web",
        version: "0.0.0",
      };
    },
    async getHowToUseText() {
      return "# How to use\ndummy";
    },
    async getPolicyText() {
      return "# Policy\ndummy";
    },
    async getOssLicenses() {
      return [];
    },
    async getUpdateInfos() {
      return [];
    },
    async getOssCommunityInfos() {
      return "";
    },
    async getQAndAText() {
      return "# Q&A\ndummy";
    },
    async getContactText() {
      return "# Contact\ndummy";
    },
    async getPrivacyPolicyText() {
      return "# Privacy Policy\ndummy";
    },
    async saveTempAudioFile(obj) {
      throw new Error(`Not implemented: saveTempAudioFile ${obj}`);
    },
    async loadTempFile() {
      throw new Error("Not implemented: loadTempFile");
    },
    async showAudioSaveDialog(obj) {
      throw new Error(`Not implemented: showAudioSaveDialog ${obj}`);
    },
    async showTextSaveDialog(obj) {
      throw new Error(`Not implemented: showTextSaveDialog ${obj}`);
    },
    async showVvppOpenDialog(obj) {
      throw new Error(`Not implemented: showVvppOpenDialog ${obj}`);
    },
    async showOpenDirectoryDialog(obj) {
      throw new Error(`Not implemented: showOpenDirectoryDialog ${obj}`);
    },
    async showProjectSaveDialog(obj) {
      throw new Error(`Not implemented: showProjectSaveDialog ${obj}`);
    },
    async showProjectLoadDialog(obj) {
      throw new Error(`Not implemented: showProjectLoadDialog ${obj}`);
    },
    async showMessageDialog(obj) {
      throw new Error(`Not implemented: showMessageDialog ${obj}`);
    },
    async showQuestionDialog(obj) {
      throw new Error(`Not implemented: showQuestionDialog ${obj}`);
    },
    async showImportFileDialog(obj) {
      throw new Error(`Not implemented: showImportFileDialog ${obj}`);
    },
    async writeFile(obj) {
      throw new Error(`Not implemented: writeFile ${obj}`);
    },
    async readFile(obj) {
      throw new Error(`Not implemented: readFile ${obj}`);
    },
    async openTextEditContextMenu() {
      throw new Error("Not implemented: openTextEditContextMenu");
    },
    async isAvailableGPUMode() {
      return false;
    },
    async isMaximizedWindow() {
      return false;
    },
    async onReceivedIPCMsg(channel, listener) {
      window.addEventListener("message", (event) => {
        if (event.data.channel === channel) {
          listener(event.data.args);
        }
      });
    },
    async closeWindow() {
      throw new Error("Not implemented: closeWindow");
    },
    async minimizeWindow() {
      throw new Error("Not implemented: minimizeWindow");
    },
    async maximizeWindow() {
      throw new Error("Not implemented: maximizeWindow");
    },
    async logError(...params) {
      console.error(...params);
    },
    async logWarn(...params) {
      console.warn(...params);
    },
    async logInfo(...params) {
      console.info(...params);
    },
    async engineInfos() {
      return engineInfos;
    },
    async restartEngine(engineId) {
      throw new Error(`Not implemented: restartEngine ${engineId}`);
    },
    async openEngineDirectory(engineId) {
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
    async checkFileExists(file) {
      return false;
    },
    async changePinWindow() {
      throw new Error("Not implemented: changePinWindow");
    },
    async getDefaultHotkeySettings() {
      return defaultHotkeySettings;
    },
    async getDefaultToolbarSetting() {
      return defaultToolbarButtonSetting;
    },
    setNativeTheme(source) {
      // 何もしない
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
    getSetting(key) {
      const setting = electronStoreSchema.parse(
        JSON.parse(localStorage.getItem(storeName) || "{}")
      );
      // 同期でも使いたいので、async functionではなく手動でPromise.resolveを返す
      return Promise.resolve(setting[key]);
    },
    setSetting(key, newValue) {
      const setting = electronStoreSchema.parse(
        JSON.parse(localStorage.getItem(storeName) || "{}")
      );
      setting[key] = newValue;
      localStorage.setItem(storeName, JSON.stringify(setting));
      // 同期でも使いたいので、async functionではなく手動でPromise.resolveを返す
      return Promise.resolve(setting[key]);
    },
    async setEngineSetting(engineId, engineSetting) {
      await this.setSetting("engineSettings", {
        ...this.getSetting("engineSettings"),
        [engineId]: engineSetting,
      });
      return;
    },
    async installVvppEngine(path) {
      throw new Error(`Not implemented: installVvppEngine ${path}`);
    },
    async uninstallVvppEngine(engineId) {
      throw new Error(`Not implemented: uninstallVvppEngine ${engineId}`);
    },
    async validateEngineDir(engineDir) {
      throw new Error(`Not implemented: validateEngineDir ${engineDir}`);
    },
    async restartApp(obj) {
      window.location.reload();
    },
  };

  try {
    localStorage.setItem(
      storeName,
      JSON.stringify(
        electronStoreSchema.parse(
          JSON.parse(localStorage.getItem(storeName) || "{}")
        )
      )
    );
  } catch (e) {
    console.warn("Failed to load store, reset store");
    localStorage.setItem(
      storeName,
      JSON.stringify(electronStoreSchema.parse({}))
    );
  }

  const engineSettings = JSON.parse(
    localStorage.getItem("voicevox_engineSettings") || "{}"
  );
  for (const engineInfo of engineInfos) {
    if (!engineSettings[engineInfo.uuid]) {
      // 空オブジェクトをパースさせることで、デフォルト値を取得する
      engineSettings[engineInfo.uuid] = engineSettingSchema.parse({});
    }
  }
  electronMock.setSetting("engineSettings", engineSettings);

  // @ts-expect-error readonlyなので代入できないが、モックのため問題ない
  window.electron = electronMock;
};

export default loadMock;
