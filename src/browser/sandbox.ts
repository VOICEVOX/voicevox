import {
  engineInfosImpl,
  getAltPortInfosImpl,
  getAppInfosImpl,
  getContactTextImpl,
  getDefaultHotkeySettingsImpl,
  getDefaultToolbarSettingImpl,
  getHowToUseTextImpl,
  getOssCommunityInfosImpl,
  getOssLicensesImpl,
  getPolicyTextImpl,
  getPrivacyPolicyTextImpl,
  getQAndATextImpl,
  getSettingImpl,
  getUpdateInfosImpl,
  hotkeySettingsImpl,
  isAvailableGpuModeImpl,
  isMaximizedWindowImpl,
  logErrorImpl,
  logInfoImpl,
  logWarnImpl,
  onVuexReadyImpl,
  openTextEditContextMenuImpl,
  setSettingImpl,
  themeImpl,
} from "./backgroundImpl";
import {
  checkFileExistsImpl,
  readFileImpl,
  showAudioSaveDialogImpl,
  showImportFileDialogImpl,
  showOpenDirectoryDialogImpl,
  showProjectLoadDialogImpl,
  showProjectSaveDialogImpl,
  showTextSaveDialogImpl,
  writeFileImpl,
} from "./fileImpl";

import { IpcSOData } from "@/type/ipc";
import { ElectronStoreType, HotkeySetting, SandboxKey } from "@/type/preload";

export const api: typeof window[typeof SandboxKey] = {
  getAppInfos() {
    return getAppInfosImpl([]);
  },
  getHowToUseText() {
    return getHowToUseTextImpl([]);
  },
  getPolicyText() {
    return getPolicyTextImpl([]);
  },
  getOssLicenses() {
    return getOssLicensesImpl([]);
  },
  getUpdateInfos() {
    return getUpdateInfosImpl([]);
  },
  getOssCommunityInfos() {
    return getOssCommunityInfosImpl([]);
  },
  getQAndAText() {
    return getQAndATextImpl([]);
  },
  getContactText() {
    return getContactTextImpl([]);
  },
  getPrivacyPolicyText() {
    return getPrivacyPolicyTextImpl([]);
  },
  async getAltPortInfos() {
    return getAltPortInfosImpl([]);
  },
  showAudioSaveDialog(obj: { title: string; defaultPath?: string }) {
    return showAudioSaveDialogImpl(obj);
  },
  showTextSaveDialog(obj: { title: string; defaultPath?: string }) {
    return showTextSaveDialogImpl(obj);
  },
  showVvppOpenDialog(obj: { title: string; defaultPath?: string }) {
    // NOTE: 今後接続先を変える手段としてVvppが使われるかもしれないので、そのタイミングで実装する
    throw new Error(
      `not implemented: showVvppOpenDialog, request: ${JSON.stringify(obj)}`
    );
  },
  showOpenDirectoryDialog(obj: { title: string }) {
    return showOpenDirectoryDialogImpl(obj);
  },
  showProjectSaveDialog(obj: { title: string; defaultPath?: string }) {
    return showProjectSaveDialogImpl(obj);
  },
  showProjectLoadDialog(obj: { title: string }) {
    return showProjectLoadDialogImpl(obj);
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
      `Not implemented: showQuestionDialog, request: ${JSON.stringify(obj)}`
    );
  },
  showImportFileDialog(obj: { title: string }) {
    return showImportFileDialogImpl(obj);
  },
  writeFile(obj: { filePath: string; buffer: ArrayBuffer }) {
    return writeFileImpl(obj);
  },
  readFile(obj: { filePath: string }) {
    return readFileImpl(obj);
  },
  openTextEditContextMenu() {
    return openTextEditContextMenuImpl([]);
  },
  isAvailableGPUMode() {
    return isAvailableGpuModeImpl([]);
  },
  isMaximizedWindow() {
    return isMaximizedWindowImpl([]);
  },
  onReceivedIPCMsg<T extends keyof IpcSOData>(
    channel: T,
    listener: (_: unknown, ...args: IpcSOData[T]["args"]) => void
  ) {
    window.addEventListener("message", (event) => {
      if (event.data.channel === channel) {
        listener(event.data.args);
      }
    });
  },
  closeWindow() {
    throw new Error(`Not supported on Browser version: closeWindow`);
  },
  minimizeWindow() {
    throw new Error(`Not supported on Browser version: minimizeWindow`);
  },
  maximizeWindow() {
    throw new Error(`Not supported on Browser version: maximizeWindow`);
  },
  logError(...params: unknown[]) {
    return logErrorImpl(params);
  },
  logWarn(...params: unknown[]) {
    return logWarnImpl(params);
  },
  logInfo(...params: unknown[]) {
    return logInfoImpl(params);
  },
  engineInfos() {
    return engineInfosImpl([]);
  },
  restartEngine(/* engineId: EngineId */) {
    throw new Error(`Not supported on Browser version: restartEngine`);
  },
  openEngineDirectory(/* engineId: EngineId */) {
    throw new Error(`Not supported on Browser version: openEngineDirectory`);
  },
  hotkeySettings(newData?: HotkeySetting) {
    return hotkeySettingsImpl([{ newData }]);
  },
  checkFileExists(file: string) {
    return checkFileExistsImpl(file);
  },
  changePinWindow() {
    throw new Error(`Not supported on Browser version: changePinWindow`);
  },
  getDefaultHotkeySettings() {
    return getDefaultHotkeySettingsImpl([]);
  },
  getDefaultToolbarSetting() {
    return getDefaultToolbarSettingImpl([]);
  },
  setNativeTheme(/* source: NativeThemeType */) {
    // TODO: Impl
    return;
  },
  theme(newData?: string) {
    return themeImpl([{ newData }]);
  },
  vuexReady() {
    return onVuexReadyImpl([]);
  },
  getSetting<Key extends keyof ElectronStoreType>(key: Key) {
    return getSettingImpl([key]) as Promise<ElectronStoreType[typeof key]>;
  },
  setSetting<Key extends keyof ElectronStoreType>(
    key: Key,
    newValue: ElectronStoreType[Key]
  ) {
    return setSettingImpl([key, newValue]) as Promise<typeof newValue>;
  },
  setEngineSetting(/* engineId: EngineId, engineSetting: EngineSetting */) {
    throw new Error(`Not supported on Browser version: setEngineSetting`);
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
  restartApp(/* obj: { isMultiEngineOffMode: boolean } */) {
    throw new Error(`Not supported on Browser version: restartApp`);
  },
};
