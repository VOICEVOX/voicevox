import { v4 } from "uuid";
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
import type { WorkerToMainMessage } from "./type";
import { IpcIHData, IpcSOData } from "@/type/ipc";
import {
  ElectronStoreType,
  EngineId,
  EngineSetting,
  HotkeySetting,
  NativeThemeType,
  SandboxKey,
} from "@/type/preload";

const worker = new Worker(new URL("./background.ts", import.meta.url), {
  type: "module",
});

const invoker = <K extends keyof IpcIHData>(
  type: K,
  args: IpcIHData[K]["args"]
): Promise<IpcIHData[K]["return"]> => {
  return new Promise((resolve) => {
    const eventId = v4();
    const cb = (ev: MessageEvent<WorkerToMainMessage>) => {
      if (ev.data.type === type && ev.data.eventId === eventId) {
        worker.removeEventListener("message", cb);
        resolve(ev.data.return);
      }
    };
    worker.addEventListener("message", cb); // 他のeventが届いた時にresolveしない様に、onceは使用していない
    worker.postMessage({ type, args, eventId } /** MainToWorkerMessage */);
  });
};

export const api: typeof window[typeof SandboxKey] = {
  getAppInfos() {
    return invoker("GET_APP_INFOS", []);
  },
  getHowToUseText() {
    return invoker("GET_HOW_TO_USE_TEXT", []);
  },
  getPolicyText() {
    return invoker("GET_POLICY_TEXT", []);
  },
  getOssLicenses() {
    return invoker("GET_OSS_LICENSES", []);
  },
  getUpdateInfos() {
    return invoker("GET_UPDATE_INFOS", []);
  },
  getOssCommunityInfos() {
    return invoker("GET_OSS_COMMUNITY_INFOS", []);
  },
  getQAndAText() {
    return invoker("GET_Q_AND_A_TEXT", []);
  },
  getContactText() {
    return invoker("GET_CONTACT_TEXT", []);
  },
  getPrivacyPolicyText() {
    return invoker("GET_PRIVACY_POLICY_TEXT", []);
  },
  getAltPortInfos() {
    return invoker("GET_ALT_PORT_INFOS", []);
  },
  async saveTempAudioFile(obj: { relativePath: string; buffer: ArrayBuffer }) {
    // DELETE_ME: もう使ってなさそう
    throw new Error(
      `not implemented: saveTempAudioFile is already obsoleted: ${JSON.stringify(
        obj
      )}`
    );
  },
  async loadTempFile() {
    // DELETE_ME: もう使ってなさそう
    throw new Error(`not implemented: loadTempFile is already obsoleted`);
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
    return invoker("SHOW_QUESTION_DIALOG", [obj]);
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
    return invoker("OPEN_TEXT_EDIT_CONTEXT_MENU", []);
  },
  isAvailableGPUMode() {
    return invoker("IS_AVAILABLE_GPU_MODE", []);
  },
  isMaximizedWindow() {
    return invoker("IS_MAXIMIZED_WINDOW", []);
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
    return invoker("CLOSE_WINDOW", []);
  },
  minimizeWindow() {
    return invoker("MINIMIZE_WINDOW", []);
  },
  maximizeWindow() {
    return invoker("MAXIMIZE_WINDOW", []);
  },
  logError(...params: unknown[]) {
    return invoker("LOG_ERROR", [params]);
  },
  logWarn(...params: unknown[]) {
    return invoker("LOG_WARN", [params]);
  },
  logInfo(...params: unknown[]) {
    return invoker("LOG_INFO", [params]);
  },
  engineInfos() {
    return invoker("ENGINE_INFOS", []);
  },
  restartEngine(engineId: EngineId) {
    return invoker("RESTART_ENGINE", [{ engineId }]);
  },
  openEngineDirectory(engineId: EngineId) {
    return invoker("OPEN_ENGINE_DIRECTORY", [{ engineId }]);
  },
  hotkeySettings(newData?: HotkeySetting) {
    return invoker("HOTKEY_SETTINGS", [{ newData }]);
  },
  checkFileExists(file: string) {
    return checkFileExistsImpl(file);
  },
  changePinWindow() {
    return invoker("CHANGE_PIN_WINDOW", []);
  },
  getDefaultHotkeySettings() {
    return invoker("GET_DEFAULT_HOTKEY_SETTINGS", []);
  },
  getDefaultToolbarSetting() {
    return invoker("GET_DEFAULT_TOOLBAR_SETTING", []);
  },
  setNativeTheme(source: NativeThemeType) {
    return invoker("SET_NATIVE_THEME", [source]);
  },
  theme(newData?: string) {
    return invoker("THEME", [{ newData }]);
  },
  vuexReady() {
    return invoker("ON_VUEX_READY", []);
  },
  getSetting<Key extends keyof ElectronStoreType>(key: Key) {
    return invoker("GET_SETTING", [key]) as Promise<
      ElectronStoreType[typeof key]
    >;
  },
  setSetting<Key extends keyof ElectronStoreType>(
    key: Key,
    newValue: ElectronStoreType[Key]
  ) {
    return invoker("SET_SETTING", [key, newValue]) as Promise<typeof newValue>;
  },
  setEngineSetting(engineId: EngineId, engineSetting: EngineSetting) {
    return invoker("SET_ENGINE_SETTING", [engineId, engineSetting]);
  },
  async installVvppEngine(path: string) {
    return invoker("INSTALL_VVPP_ENGINE", [path]);
  },
  async uninstallVvppEngine(engineId: EngineId) {
    return invoker("UNINSTALL_VVPP_ENGINE", [engineId]);
  },
  validateEngineDir(engineDir: string) {
    return invoker("VALIDATE_ENGINE_DIR", [{ engineDir }]);
  },
  restartApp(obj: { isMultiEngineOffMode: boolean }) {
    return invoker("RESTART_APP", [obj]);
  },
};
