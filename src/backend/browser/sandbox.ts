import { defaultEngine } from "./contract";
import {
  checkFileExistsImpl,
  readFileImpl,
  showOpenDirectoryDialogImpl,
  showOpenFilePickerImpl,
  writeFileImpl,
} from "./fileImpl";
import { getConfigManager } from "./browserConfig";
import { IpcSOData } from "@/type/ipc";
import {
  defaultHotkeySettings,
  defaultToolbarButtonSetting,
  EngineId,
  EngineSettingType,
  EngineSettings,
  HotkeySettingType,
  Sandbox,
} from "@/type/preload";
import { AssetTextFileNames } from "@/type/staticResources";

const toStaticPath = (fileName: string) =>
  `${import.meta.env.BASE_URL}/${fileName}`.replaceAll(/\/\/+/, "/");

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
  getAppInfos() {
    const appInfo = {
      name: import.meta.env.VITE_APP_NAME,
      version: import.meta.env.VITE_APP_VERSION,
    };
    return Promise.resolve(appInfo);
  },
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
  showAudioSaveDialog(obj: { title: string; defaultPath?: string }) {
    return new Promise((resolve, reject) => {
      if (obj.defaultPath == undefined) {
        reject(
          // storeやvue componentからdefaultPathを設定していなかったらrejectされる
          new Error(
            "ブラウザ版ではファイルの保存機能が一部サポートされていません。",
          ),
        );
      } else {
        resolve(obj.defaultPath);
      }
    });
  },
  showTextSaveDialog(obj: { title: string; defaultPath?: string }) {
    return new Promise((resolve, reject) => {
      if (obj.defaultPath == undefined) {
        reject(
          // storeやvue componentからdefaultPathを設定していなかったらrejectされる
          new Error(
            "ブラウザ版ではファイルの保存機能が一部サポートされていません。",
          ),
        );
      } else {
        resolve(obj.defaultPath);
      }
    });
  },
  showSaveDirectoryDialog(obj: { title: string }) {
    return showOpenDirectoryDialogImpl(obj);
  },
  showVvppOpenDialog(obj: { title: string; defaultPath?: string }) {
    // NOTE: 今後接続先を変える手段としてVvppが使われるかもしれないので、そのタイミングで実装する
    throw new Error(
      `not implemented: showVvppOpenDialog, request: ${JSON.stringify(obj)}`,
    );
  },
  showOpenDirectoryDialog(obj: { title: string }) {
    return showOpenDirectoryDialogImpl(obj);
  },
  showProjectSaveDialog(obj: { title: string; defaultPath?: string }) {
    return new Promise((resolve, reject) => {
      if (obj.defaultPath == undefined) {
        reject(
          // storeやvue componentからdefaultPathを設定していなかったらrejectされる
          new Error(
            "ブラウザ版ではファイルの保存機能が一部サポートされていません。",
          ),
        );
      } else {
        resolve(obj.defaultPath);
      }
    });
  },
  async showProjectLoadDialog() {
    return showOpenFilePickerImpl({
      multiple: false,
      fileTypes: [
        {
          description: "Voicevox Project File",
          accept: {
            "application/json": [".vvproj"],
          },
        },
      ],
    });
  },
  async showImportFileDialog(obj: {
    name?: string;
    extensions?: string[];
    title: string;
  }) {
    const fileHandle = await showOpenFilePickerImpl({
      multiple: false,
      fileTypes: [
        {
          description: obj.name ?? "Text",
          accept: obj.extensions
            ? {
                "application/octet-stream": obj.extensions.map(
                  (ext) => `.${ext}`,
                ),
              }
            : {
                "plain/text": [".txt"],
              },
        },
      ],
    });
    return fileHandle?.[0];
  },
  writeFile(obj: { filePath: string; buffer: ArrayBuffer }) {
    return writeFileImpl(obj);
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
  maximizeWindow() {
    throw new Error(`Not supported on Browser version: maximizeWindow`);
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
  getDefaultHotkeySettings() {
    return Promise.resolve(defaultHotkeySettings);
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
};
