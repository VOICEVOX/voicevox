import { defaultEngine } from "./contract";
import {
  checkFileExistsImpl,
  readFileImpl,
  showSaveFilePickerImpl,
  showOpenDirectoryDialogImpl,
  showOpenFilePickerImpl,
  WritableFilePath,
  writeFileImpl,
} from "./fileImpl";
import { getConfigManager } from "./browserConfig";
import { isFakePath } from "./fakePath";
import { IpcSOData } from "@/type/ipc";
import {
  defaultToolbarButtonSetting,
  EngineId,
  EngineSettingType,
  EngineSettings,
  Sandbox,
} from "@/type/preload";
import { AssetTextFileNames } from "@/type/staticResources";
import { HotkeySettingType } from "@/domain/hotkeyAction";
import path from "@/helpers/path";

const toStaticPath = (fileName: string) =>
  `${import.meta.env.BASE_URL}/${fileName}`.replaceAll(/\/\/+/g, "/");

// FIXME: asを使わないようオーバーロードにした。オーバーロードも使わない書き方にしたい。
function onReceivedIPCMsg<
  T extends {
    [K in keyof IpcSOData]: (
      event: unknown,
      ...args: IpcSOData[K]["args"]
    ) => Promise<IpcSOData[K]["return"]> | IpcSOData[K]["return"];
  },
>(listeners: T): void;
function onReceivedIPCMsg(listeners: {
  [key: string]: (event: unknown, ...args: unknown[]) => unknown;
}) {
  // NOTE: もしブラウザ本体からレンダラへのメッセージを実装するならこんな感じ
  window.addEventListener(
    "message",
    ({
      data,
    }: MessageEvent<{
      channel: keyof IpcSOData;
      args: IpcSOData[keyof IpcSOData]["args"];
    }>) => {
      listeners[data.channel]?.({}, ...data.args);
    },
  );
}

/**
 * Browser版のSandBox実装
 * src/type/preload.tsのSandboxを変更した場合は、interfaceに追従した変更が必要
 * まだ開発中のため、Browser版の実装も同時に行えない場合は、メソッドを追加して throw new Error() する
 */
export const api: Sandbox = {
  async getTextAsset(textType) {
    const fileName = AssetTextFileNames[textType];
    const v = await fetch(toStaticPath(fileName));
    if (textType === "OssLicenses" || textType === "UpdateInfos") {
      return v.json();
    }
    return v.text();
  },
  getAltPortInfos() {
    // NOTE: ブラウザ版ではサポートされていません
    return Promise.resolve({});
  },
  getInitialProjectFilePath() {
    return Promise.resolve(undefined);
  },
  showSaveDirectoryDialog(obj: { title: string }) {
    return showOpenDirectoryDialogImpl(obj);
  },
  showOpenDirectoryDialog(obj: { title: string }) {
    return showOpenDirectoryDialogImpl(obj);
  },
  async showOpenFileDialog(obj: {
    title: string;
    name: string;
    mimeType: string;
    extensions: string[];
  }) {
    const fileHandle = await showOpenFilePickerImpl({
      multiple: false,
      fileTypes: [
        {
          description: obj.name,
          accept: { [obj.mimeType]: obj.extensions.map((ext) => `.${ext}`) },
        },
      ],
    });
    return fileHandle?.[0];
  },
  async showSaveFileDialog(obj: {
    title: string;
    name: string;
    extensions: string[];
    defaultPath?: string;
  }) {
    const fileHandle = await showSaveFilePickerImpl(obj);
    return fileHandle;
  },
  writeFile(obj: { filePath: string; buffer: ArrayBuffer }) {
    let filePath: WritableFilePath;
    if (isFakePath(obj.filePath)) {
      filePath = { type: "fake", path: obj.filePath };
    } else if (obj.filePath.includes(path.SEPARATOR)) {
      filePath = { type: "child", path: obj.filePath };
    } else {
      filePath = { type: "nameOnly", path: obj.filePath };
    }

    return writeFileImpl({ filePath, buffer: obj.buffer });
  },
  readFile(obj: { filePath: string }) {
    return readFileImpl(obj.filePath);
  },
  isAvailableGPUMode() {
    // TODO: WebAssembly版をサポートする時に実装する
    // FIXME: canvasでWebGLから調べたり、WebGPUがサポートされているかを調べたりで判断は出来そう
    return Promise.resolve(false);
  },
  isMaximizedWindow() {
    // NOTE: UIの表示状態の制御のためだけなので固定値を返している
    return Promise.resolve(true);
  },
  onReceivedIPCMsg,
  closeWindow() {
    throw new Error(`Not supported on Browser version: closeWindow`);
  },
  minimizeWindow() {
    throw new Error(`Not supported on Browser version: minimizeWindow`);
  },
  toggleMaximizeWindow() {
    throw new Error(`Not supported on Browser version: toggleMaximizeWindow`);
  },
  toggleFullScreen() {
    throw new Error(`Not supported on Browser version: toggleFullScreen`);
  },
  zoomIn() {
    throw new Error(`Not supported on Browser version: zoomIn`);
  },
  zoomOut() {
    throw new Error(`Not supported on Browser version: zoomOut`);
  },
  zoomReset() {
    throw new Error(`Not supported on Browser version: zoomReset`);
  },

  /* eslint-disable no-console */ // ログの吐き出し先は console ぐらいしかないので、ここでは特例で許可している
  logError(...params: unknown[]) {
    console.error(...params);
    return;
  },
  logWarn(...params: unknown[]) {
    console.warn(...params);
    return;
  },
  logInfo(...params: unknown[]) {
    console.info(...params);
    return;
  },
  openLogDirectory() {
    throw new Error(`Not supported on Browser version: openLogDirectory`);
  },
  /* eslint-enable no-console */
  engineInfos() {
    return Promise.resolve([defaultEngine]);
  },
  restartEngine(/* engineId: EngineId */) {
    throw new Error(`Not supported on Browser version: restartEngine`);
  },
  openEngineDirectory(/* engineId: EngineId */) {
    throw new Error(`Not supported on Browser version: openEngineDirectory`);
  },
  async hotkeySettings(newData?: HotkeySettingType) {
    if (newData != undefined) {
      const hotkeySettings = await this.getSetting("hotkeySettings");
      const hotkeySetting = hotkeySettings.find(
        (hotkey) => hotkey.action == newData.action,
      );
      if (hotkeySetting != undefined) {
        hotkeySetting.combination = newData.combination;
      }
      await this.setSetting("hotkeySettings", hotkeySettings);
    }
    return this.getSetting("hotkeySettings");
  },
  checkFileExists(file: string) {
    return checkFileExistsImpl(file);
  },
  changePinWindow() {
    throw new Error(`Not supported on Browser version: changePinWindow`);
  },
  getDefaultToolbarSetting() {
    return Promise.resolve(defaultToolbarButtonSetting);
  },
  setNativeTheme(/* source: NativeThemeType */) {
    // TODO: Impl
    return;
  },
  vuexReady() {
    // NOTE: 何もしなくて良さそう
    return Promise.resolve();
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
  installVvppEngine(/* path: string */) {
    throw new Error(`Not supported on Browser version: installVvppEngine`);
  },
  uninstallVvppEngine(/* engineId: EngineId */) {
    throw new Error(`Not supported on Browser version: uninstallVvppEngine`);
  },
  validateEngineDir(/* engineDir: string */) {
    throw new Error(`Not supported on Browser version: validateEngineDir`);
  },
  reloadApp(/* obj: { isMultiEngineOffMode: boolean } */) {
    throw new Error(`Not supported on Browser version: reloadApp`);
  },
  getPathForFile(/* file: File */) {
    throw new Error(`Not supported on Browser version: getPathForFile`);
  },
};
