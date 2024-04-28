import { getConfigManager } from "./vstConfig";
import {
  getProject,
  getProjectName,
  getVersion,
  readFile,
  setProject,
  showImportFileDialog,
} from "./ipc";
import { defaultEngine } from "@/backend/browser/contract";
import { IpcSOData } from "@/type/ipc";
import {
  defaultHotkeySettings,
  defaultToolbarButtonSetting,
  configSchema,
  EngineId,
  EngineSettingType,
  EngineSettings,
  HotkeySettingType,
  Sandbox,
  ThemeConf,
} from "@/type/preload";
import {
  ContactTextFileName,
  HowToUseTextFileName,
  OssCommunityInfosFileName,
  OssLicensesJsonFileName,
  PolicyTextFileName,
  PrivacyPolicyTextFileName,
  QAndATextFileName,
  UpdateInfosJsonFileName,
} from "@/type/staticResources";
import { failure, success } from "@/type/result";

// TODO: base pathを設定できるようにするか、ビルド時埋め込みにする
const toStaticPath = (fileName: string) => `/${fileName}`;

export const projectFilePath = "/meta/vst-project.vvproj";
/**
 * VST版のSandBox実装
 * src/type/preload.tsのSandboxを変更した場合は、interfaceに追従した変更が必要
 * まだ開発中のため、VST版の実装も同時に行えない場合は、メソッドを追加して throw new Error() する
 */
export const api: Sandbox = {
  async getAppInfos() {
    const appInfo = {
      name: await getProjectName(),
      version: await getVersion(),
    };
    return appInfo;
  },
  async getHowToUseText() {
    const v = await fetch(toStaticPath(HowToUseTextFileName));
    return await v.text();
  },
  async getPolicyText() {
    const v = await fetch(toStaticPath(PolicyTextFileName));
    return await v.text();
  },
  async getOssLicenses() {
    const v = await fetch(toStaticPath(OssLicensesJsonFileName));
    return await v.json();
  },
  async getUpdateInfos() {
    const v = await fetch(toStaticPath(UpdateInfosJsonFileName));
    return await v.json();
  },
  async getOssCommunityInfos() {
    const v = await fetch(toStaticPath(OssCommunityInfosFileName));
    return await v.text();
  },
  async getQAndAText() {
    const v = await fetch(toStaticPath(QAndATextFileName));
    return await v.text();
  },
  async getContactText() {
    const v = await fetch(toStaticPath(ContactTextFileName));
    return await v.text();
  },
  async getPrivacyPolicyText() {
    const v = await fetch(toStaticPath(PrivacyPolicyTextFileName));
    return await v.text();
  },
  getAltPortInfos() {
    // NOTE: ブラウザ版ではサポートされていません
    return Promise.resolve({});
  },
  showAudioSaveDialog() {
    throw new Error("Not implemented");
  },
  showTextSaveDialog() {
    throw new Error("Not implemented");
  },
  showVvppOpenDialog() {
    throw new Error("Not implemented");
  },
  showOpenDirectoryDialog() {
    throw new Error("Not implemented");
  },
  showProjectSaveDialog() {
    throw new Error("Not implemented");
  },
  async showProjectLoadDialog({ title }) {
    const filePath = await window.backend.showImportFileDialog({
      title,
      name: "VOICEVOX Project file",
      extensions: ["vvproj"],
    });
    return filePath ? [filePath] : undefined;
  },
  showSaveDirectoryDialog() {
    throw new Error("Not implemented");
  },
  showMessageDialog(obj: {
    type: "none" | "info" | "error" | "question" | "warning";
    title: string;
    message: string;
  }) {
    window.alert(`${obj.title}\n${obj.message}`);
    // NOTE: どの呼び出し元も、return valueを使用していないので雑に対応している
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Promise.resolve({} as any);
  },
  showQuestionDialog(obj: {
    type: "none" | "info" | "error" | "question" | "warning";
    title: string;
    message: string;
    buttons: string[];
    cancelId?: number;
    defaultId?: number;
  }) {
    // FIXME
    // TODO: 例えば動的にdialog要素をDOMに生成して、それを表示させるみたいのはあるかもしれない
    throw new Error(
      `Not implemented: showQuestionDialog, request: ${JSON.stringify(obj)}`,
    );
  },
  showImportFileDialog(options) {
    return showImportFileDialog(options);
  },
  async writeFile(options) {
    if (options.filePath === projectFilePath) {
      await setProject(new TextDecoder().decode(options.buffer));
      return success(undefined);
    }
    throw new Error("Not implemented");
  },
  async readFile(options) {
    if (options.filePath === projectFilePath) {
      const project = await getProject();
      const buffer = new TextEncoder().encode(project);
      return success(buffer);
    } else {
      try {
        return success(await readFile(options.filePath));
      } catch (e) {
        return failure(e as Error);
      }
    }
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
  onReceivedIPCMsg<T extends keyof IpcSOData>(
    channel: T,
    listener: (_: unknown, ...args: IpcSOData[T]["args"]) => void,
  ) {
    window.addEventListener("message", (event) => {
      if (event.data.channel == channel) {
        listener(event.data.args);
      }
    });
  },
  closeWindow() {
    throw new Error("Not implemented");
  },
  minimizeWindow() {
    throw new Error("Not implemented");
  },
  maximizeWindow() {
    throw new Error("Not implemented");
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
  /* eslint-enable no-console */
  openLogDirectory() {
    throw new Error("Not implemented");
  },
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
    type HotkeySettingType = ReturnType<
      (typeof configSchema)["parse"]
    >["hotkeySettings"];
    if (newData != undefined) {
      const hotkeySettings = (await this.getSetting(
        "hotkeySettings",
      )) as HotkeySettingType;
      const hotkeySetting = hotkeySettings.find(
        (hotkey) => hotkey.action == newData.action,
      );
      if (hotkeySetting != undefined) {
        hotkeySetting.combination = newData.combination;
      }
      await this.setSetting("hotkeySettings", hotkeySettings);
    }
    return this.getSetting("hotkeySettings") as Promise<HotkeySettingType>;
  },
  checkFileExists() {
    throw new Error("Not implemented");
  },
  changePinWindow() {
    throw new Error("Not implemented");
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
  async theme(newData?: string) {
    if (newData != undefined) {
      await this.setSetting("currentTheme", newData);
      return;
    }
    // NOTE: Electron版では起動時にテーマ情報が必要なので、
    //       この実装とは違って起動時に読み込んだキャッシュを返すだけになっている。
    return Promise.all(
      // FIXME: themeファイルのいい感じのパスの設定
      ["/themes/default.json", "/themes/dark.json"].map((url) =>
        fetch(url).then((res) => res.json()),
      ),
    )
      .then((v) => ({
        currentTheme: "Default",
        availableThemes: v,
      }))
      .then((v) =>
        this.getSetting("currentTheme").then(
          (currentTheme) =>
            ({
              ...v,
              currentTheme,
            }) as { currentTheme: string; availableThemes: ThemeConf[] },
        ),
      );
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
