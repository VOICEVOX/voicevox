import { v4 } from "uuid";
import type { WorkerToMainMessage } from "./type";
import { IpcIHData, IpcSOData } from "@/type/ipc";
import {
  ElectronStoreType,
  EngineId,
  EngineSetting,
  HotkeySetting,
  NativeThemeType,
  SandboxKey,
  WriteFileErrorResult,
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

let directoryHandler: FileSystemDirectoryHandle | undefined = undefined;

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
  async showAudioSaveDialog(obj: { title: string; defaultPath?: string }) {
    // Wave File以外のものを同一ディレクトリに保存したり、名前を変えて保存するためにDirectoryのPickerを使用している
    // FIXME: 途中でディレクトリを変えたいとかには対応できない…
    if (directoryHandler === undefined) {
      const _directoryHandler = await window
        .showDirectoryPicker({
          mode: "readwrite",
        })
        .catch(() => undefined);
      if (_directoryHandler === undefined) {
        return undefined;
      }

      directoryHandler = _directoryHandler;
    }

    const { defaultPath } = obj;
    const fileHandle = await window
      .showSaveFilePicker({
        types: [
          {
            description: "Wave File",
            accept: {
              "audio/wav": [".wav"],
            },
          },
        ],
        excludeAcceptAllOption: true,
        suggestedName: defaultPath,
      })
      .catch(() => undefined);
    if (fileHandle === undefined) {
      return undefined;
    }
    return fileHandle.name;
  },
  showTextSaveDialog(obj: { title: string; defaultPath?: string }) {
    return invoker("SHOW_TEXT_SAVE_DIALOG", [obj]);
  },
  showVvppOpenDialog(obj: { title: string; defaultPath?: string }) {
    return invoker("SHOW_VVPP_OPEN_DIALOG", [obj]);
  },
  async showOpenDirectoryDialog(/** obj: { title: string } */) {
    const _directoryHandler = await window
      .showDirectoryPicker({
        mode: "readwrite",
      })
      .catch(() => undefined);
    if (_directoryHandler === undefined) {
      return undefined;
    }

    directoryHandler = _directoryHandler;
    return _directoryHandler.name;
  },
  showProjectSaveDialog(obj: { title: string; defaultPath?: string }) {
    return invoker("SHOW_PROJECT_SAVE_DIALOG", [obj]);
  },
  showProjectLoadDialog(obj: { title: string }) {
    return invoker("SHOW_PROJECT_LOAD_DIALOG", [obj]);
  },
  showMessageDialog(obj: {
    type: "none" | "info" | "error" | "question" | "warning";
    title: string;
    message: string;
  }) {
    return invoker("SHOW_MESSAGE_DIALOG", [obj]);
  },
  showQuestionDialog(obj: {
    type: "none" | "info" | "error" | "question" | "warning";
    title: string;
    message: string;
    buttons: string[];
    cancelId?: number;
    defaultId?: number;
  }) {
    return invoker("SHOW_QUESTION_DIALOG", [obj]);
  },
  showImportFileDialog(obj: { title: string }) {
    return invoker("SHOW_IMPORT_FILE_DIALOG", [obj]);
  },
  writeFile(obj: { filePath: string; buffer: ArrayBuffer }) {
    // FIXME: fixedDirectoryが設定されている場合は、絶対パスでの指定になるためディレクトリへの権限が得られていない状態になり失敗する
    if (directoryHandler === undefined) {
      return Promise.resolve({
        code: undefined,
        message: "ディレクトリへのアクセス許可がありません",
      });
    }

    /** FIXME: 以下のファイル名に関する処理は切り出して checkFile などでも再利用する */
    let path = obj.filePath;

    // FIXME: / や \ は OS 依存のため、どうにかする
    if (path.includes("/") || path.includes("\\")) {
      if (path.startsWith(directoryHandler.name)) {
        path = path.slice(directoryHandler.name.length + 1 /* / or \ */);
      }
    }

    return directoryHandler
      ?.getFileHandle(path, { create: true })
      .then((fileHandle) => {
        return fileHandle.createWritable().then((writable) => {
          return writable.write(obj.buffer).then(() => writable.close());
        });
      })
      .then(() => undefined)
      .catch((e) => {
        // FIXME
        console.error(e);
        return {
          code: undefined,
          message: e.message as string,
        } as WriteFileErrorResult;
      });
  },
  readFile(obj: { filePath: string }) {
    return invoker("READ_FILE", [obj]);
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
    console.dir(`channel: ${channel}, listener: ${listener}`);
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
  async checkFileExists(file: string) {
    if (directoryHandler === undefined) {
      // FIXME: trueだとloopするはず
      return Promise.resolve(false);
    }
    // NOTE: fixedDirectoryが設定されている場合、filePathが名前だけでなくディレクトリも含んでいるため、失敗する
    const fileEntries = [];
    for await (const [
      fileOrDirectoryName,
      entry,
    ] of directoryHandler.entries()) {
      if (entry.kind === "file") {
        fileEntries.push(fileOrDirectoryName);
      }
    }

    let path = file;

    // FIXME: / や \ は OS 依存のため、どうにかする
    if (path.includes("/") || path.includes("\\")) {
      if (path.startsWith(directoryHandler.name)) {
        path = path.slice(directoryHandler.name.length + 1 /* / or \ */);
      }
    }

    return Promise.resolve(fileEntries.includes(path));
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
