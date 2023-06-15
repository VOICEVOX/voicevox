import { sep } from "path";
import { v4 } from "uuid";
import { directoryHandlerStoreKey } from "./contract";
import type { WorkerToMainMessage } from "./type";
import { openDB } from "./store";
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

const lastSelectedDirectoryHandlerSymbol = Symbol(
  "lastSelectedDirectoryHandler"
);
const directoryHandlerMap: Map<
  string | typeof lastSelectedDirectoryHandlerSymbol,
  FileSystemDirectoryHandle
> = new Map();

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
    if (
      directoryHandlerMap.get(lastSelectedDirectoryHandlerSymbol) === undefined
    ) {
      // Wave File以外のものを同一ディレクトリに保存したり、名前を変えて保存するためにDirectoryのPickerを使用している
      // FIXME: 途中でディレクトリを変えたいとかには対応できない…
      const _directoryHandler = await window
        .showDirectoryPicker({
          mode: "readwrite",
        })
        .catch(() => undefined);
      if (_directoryHandler === undefined) {
        return undefined;
      }

      const db = await openDB();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(
          directoryHandlerStoreKey,
          "readwrite"
        );
        const store = transaction.objectStore(directoryHandlerStoreKey);
        const request = store.put(_directoryHandler, _directoryHandler.name);
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error);
        };
      }).catch((e) => {
        console.error(e);
        // 握り潰してる
      });

      directoryHandlerMap.set(
        lastSelectedDirectoryHandlerSymbol,
        _directoryHandler
      );
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

    // NOTE: ディレクトリのハンドラと異なるディレクトリを選択されても検知できない
    return fileHandle.name;
  },
  // FIXME: showSaveFilePickerのtypesが違うだけなので、いい感じにする
  async showTextSaveDialog(obj: { title: string; defaultPath?: string }) {
    if (
      directoryHandlerMap.get(lastSelectedDirectoryHandlerSymbol) === undefined
    ) {
      // Wave File以外のものを同一ディレクトリに保存したり、名前を変えて保存するためにDirectoryのPickerを使用している
      // FIXME: 途中でディレクトリを変えたいとかには対応できない…
      const _directoryHandler = await window
        .showDirectoryPicker({
          mode: "readwrite",
        })
        .catch(() => undefined);
      if (_directoryHandler === undefined) {
        return undefined;
      }

      const db = await openDB();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(
          directoryHandlerStoreKey,
          "readwrite"
        );
        const store = transaction.objectStore(directoryHandlerStoreKey);
        const request = store.put(_directoryHandler, _directoryHandler.name);
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error);
        };
      }).catch((e) => {
        console.error(e);
        // 握り潰してる
      });

      directoryHandlerMap.set(
        lastSelectedDirectoryHandlerSymbol,
        _directoryHandler
      );
    }

    const { defaultPath } = obj;
    const fileHandle = await window
      .showSaveFilePicker({
        types: [
          {
            description: "Text File",
            accept: {
              "text/plain": [".txt"],
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

    // NOTE: ディレクトリのハンドラと異なるディレクトリを選択されても検知できない
    return fileHandle.name;
  },
  showVvppOpenDialog(obj: { title: string; defaultPath?: string }) {
    // NOTE: 今後接続先を変える手段としてVvppが使われるかもしれないので、そのタイミングで実装する
    throw new Error(
      `not implemented: showVvppOpenDialog, request: ${JSON.stringify(obj)}`
    );
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

    const db = await openDB();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(directoryHandlerStoreKey, "readwrite");
      const store = transaction.objectStore(directoryHandlerStoreKey);
      const request = store.put(_directoryHandler, _directoryHandler.name);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
    }).catch((e) => {
      console.error(e);
      // 握り潰してる
    });

    // NOTE: 同一のディレクトリ名だった場合、後で選択されたディレクトリがそれ移行の処理で使用されるため、意図しない保存が発生するかもしれない
    directoryHandlerMap.set(_directoryHandler.name, _directoryHandler);
    return _directoryHandler.name;
  },
  // FIXME: showSaveFilePickerのtypesが違うだけなので、いい感じにする
  async showProjectSaveDialog(obj: { title: string; defaultPath?: string }) {
    if (
      directoryHandlerMap.get(lastSelectedDirectoryHandlerSymbol) === undefined
    ) {
      // Wave File以外のものを同一ディレクトリに保存したり、名前を変えて保存するためにDirectoryのPickerを使用している
      // FIXME: 途中でディレクトリを変えたいとかには対応できない…
      const _directoryHandler = await window
        .showDirectoryPicker({
          mode: "readwrite",
        })
        .catch(() => undefined);
      if (_directoryHandler === undefined) {
        return undefined;
      }

      const db = await openDB();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(
          directoryHandlerStoreKey,
          "readwrite"
        );
        const store = transaction.objectStore(directoryHandlerStoreKey);
        const request = store.put(_directoryHandler, _directoryHandler.name);
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error);
        };
      }).catch((e) => {
        console.error(e);
        // 握り潰してる
      });

      directoryHandlerMap.set(
        lastSelectedDirectoryHandlerSymbol,
        _directoryHandler
      );
    }

    const { defaultPath } = obj;
    const fileHandle = await window
      .showSaveFilePicker({
        types: [
          {
            description: "VOICEVOX Project file",
            accept: {
              "application/json": [".vvproj"],
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

    // NOTE: ディレクトリのハンドラと異なるディレクトリを選択されても検知できない
    return fileHandle.name;
  },
  // FIXME: showSaveFilePickerのtypesが違うだけなので、いい感じにする
  async showProjectLoadDialog(/** obj: { title: string } */) {
    if (
      directoryHandlerMap.get(lastSelectedDirectoryHandlerSymbol) === undefined
    ) {
      // Wave File以外のものを同一ディレクトリに保存したり、名前を変えて保存するためにDirectoryのPickerを使用している
      // FIXME: 途中でディレクトリを変えたいとかには対応できない…
      const _directoryHandler = await window
        .showDirectoryPicker({
          mode: "readwrite",
        })
        .catch(() => undefined);
      if (_directoryHandler === undefined) {
        return undefined;
      }

      const db = await openDB();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(
          directoryHandlerStoreKey,
          "readwrite"
        );
        const store = transaction.objectStore(directoryHandlerStoreKey);
        const request = store.put(_directoryHandler, _directoryHandler.name);
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error);
        };
      }).catch((e) => {
        console.error(e);
        // 握り潰してる
      });

      directoryHandlerMap.set(
        lastSelectedDirectoryHandlerSymbol,
        _directoryHandler
      );
    }

    const fileHandle = await window
      .showOpenFilePicker({
        types: [
          {
            description: "VOICEVOX Project file",
            accept: {
              "application/json": [".vvproj"],
            },
          },
        ],
        excludeAcceptAllOption: true,
        multiple: false,
      })
      .catch(() => undefined);
    if (fileHandle === undefined) {
      return undefined;
    }

    return fileHandle.map((v) => v.name);
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
    // TODO: 例えば動的にdialog要素をDOMに生成して、それを表示させるみたいのはあるかもしれない
    return invoker("SHOW_QUESTION_DIALOG", [obj]);
  },
  // FilePath, textDialogと一緒でいいかも, description text
  async showImportFileDialog(/** obj: { title: string } */) {
    if (
      directoryHandlerMap.get(lastSelectedDirectoryHandlerSymbol) === undefined
    ) {
      // Wave File以外のものを同一ディレクトリに保存したり、名前を変えて保存するためにDirectoryのPickerを使用している
      // FIXME: 途中でディレクトリを変えたいとかには対応できない…
      const _directoryHandler = await window
        .showDirectoryPicker({
          mode: "readwrite",
        })
        .catch(() => undefined);
      if (_directoryHandler === undefined) {
        return undefined;
      }

      const db = await openDB();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(
          directoryHandlerStoreKey,
          "readwrite"
        );
        const store = transaction.objectStore(directoryHandlerStoreKey);
        const request = store.put(_directoryHandler, _directoryHandler.name);
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error);
        };
      }).catch((e) => {
        console.error(e);
        // 握り潰してる
      });

      directoryHandlerMap.set(
        lastSelectedDirectoryHandlerSymbol,
        _directoryHandler
      );
    }

    const fileHandle = await window
      .showOpenFilePicker({
        types: [
          {
            description: "Text",
            accept: {
              "text/plain": [".txt"],
            },
          },
        ],
        excludeAcceptAllOption: true,
        multiple: false,
      })
      .catch(() => undefined);
    if (fileHandle === undefined) {
      return undefined;
    }

    return fileHandle[0].name;
  },
  async writeFile(obj: { filePath: string; buffer: ArrayBuffer }) {
    if (
      directoryHandlerMap.get(lastSelectedDirectoryHandlerSymbol) ===
        undefined &&
      obj.filePath.indexOf(sep) === -1
    ) {
      return Promise.resolve({
        code: undefined,
        message: "ディレクトリへのアクセス許可がありません",
      });
    }

    let directoryHandler = directoryHandlerMap.get(
      lastSelectedDirectoryHandlerSymbol
    );

    /** FIXME: 以下のファイル名に関する処理は切り出して checkFile などでも再利用する */
    let path = obj.filePath;

    if (path.includes(sep)) {
      const maybeDirectoryHandlerName = path.split(sep)[0];
      if (directoryHandlerMap.has(maybeDirectoryHandlerName)) {
        path = path.slice(maybeDirectoryHandlerName.length + sep.length);
        directoryHandler = directoryHandlerMap.get(maybeDirectoryHandlerName);
      } else {
        const db = await openDB();
        const maybeFixedDirectory = await new Promise<
          FileSystemDirectoryHandle | undefined
        >((resolve, reject) => {
          const transaction = db.transaction(
            directoryHandlerStoreKey,
            "readonly"
          );
          const store = transaction.objectStore(directoryHandlerStoreKey);
          const request = store.get(maybeDirectoryHandlerName);
          request.onsuccess = () => {
            resolve(request.result);
          };
          request.onerror = () => {
            reject(request.error);
          };
        }).catch((e) => {
          console.error(e);
          // 握り潰してる
          return undefined;
        });

        if (maybeFixedDirectory === undefined) {
          return Promise.resolve({
            code: undefined,
            message: "ディレクトリへのアクセス許可がありません",
          });
        }

        if (
          !(await maybeFixedDirectory.requestPermission({ mode: "readwrite" }))
        ) {
          return Promise.resolve({
            code: undefined,
            message: "ディレクトリへのアクセス許可がありません",
          });
        }

        directoryHandlerMap.set(maybeDirectoryHandlerName, maybeFixedDirectory);
        directoryHandler = maybeFixedDirectory;
      }
    }

    if (directoryHandler === undefined) {
      return Promise.resolve({
        code: undefined,
        message: "ディレクトリへのアクセス許可がありません",
      });
    }

    return directoryHandler
      .getFileHandle(path, { create: true })
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
  async readFile(obj: { filePath: string }) {
    if (
      directoryHandlerMap.get(lastSelectedDirectoryHandlerSymbol) ===
        undefined &&
      obj.filePath.indexOf(sep) === -1
    ) {
      return Promise.reject(
        new Error("ディレクトリへのアクセス許可がありません")
      );
    }

    let directoryHandler = directoryHandlerMap.get(
      lastSelectedDirectoryHandlerSymbol
    );

    /** FIXME: 以下のファイル名に関する処理は切り出して checkFile などでも再利用する */
    let path = obj.filePath;

    if (path.includes(sep)) {
      const maybeDirectoryHandlerName = path.split(sep)[0];
      if (directoryHandlerMap.has(maybeDirectoryHandlerName)) {
        path = path.slice(maybeDirectoryHandlerName.length + sep.length);
        directoryHandler = directoryHandlerMap.get(maybeDirectoryHandlerName);
      } else {
        const db = await openDB();
        const maybeFixedDirectory = await new Promise<
          FileSystemDirectoryHandle | undefined
        >((resolve, reject) => {
          const transaction = db.transaction(
            directoryHandlerStoreKey,
            "readonly"
          );
          const store = transaction.objectStore(directoryHandlerStoreKey);
          const request = store.get(maybeDirectoryHandlerName);
          request.onsuccess = () => {
            resolve(request.result);
          };
          request.onerror = () => {
            reject(request.error);
          };
        }).catch((e) => {
          console.error(e);
          // 握り潰してる
          return undefined;
        });

        if (maybeFixedDirectory === undefined) {
          return Promise.reject(
            new Error("ディレクトリへのアクセス許可がありません")
          );
        }

        if (
          !(await maybeFixedDirectory.requestPermission({ mode: "readwrite" }))
        ) {
          return Promise.reject(
            new Error("ディレクトリへのアクセス許可がありません")
          );
        }

        directoryHandlerMap.set(maybeDirectoryHandlerName, maybeFixedDirectory);
        directoryHandler = maybeFixedDirectory;
      }
    }

    if (directoryHandler === undefined) {
      return Promise.reject(
        new Error("ディレクトリへのアクセス許可がありません")
      );
    }

    return directoryHandler.getFileHandle(path).then((fileHandle) => {
      return fileHandle.getFile().then((file) => {
        return file.arrayBuffer();
      });
    });
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
  async checkFileExists(file: string) {
    if (
      directoryHandlerMap.get(lastSelectedDirectoryHandlerSymbol) ===
        undefined &&
      file.indexOf(sep) === -1
    ) {
      // FIXME: trueだとloopするはず
      return Promise.resolve(false);
    }

    let directoryHandler = directoryHandlerMap.get(
      lastSelectedDirectoryHandlerSymbol
    );

    /** FIXME: 以下のファイル名に関する処理は切り出して checkFile などでも再利用する */
    let path = file;

    if (path.includes(sep)) {
      const maybeDirectoryHandlerName = path.split(sep)[0];
      if (directoryHandlerMap.has(maybeDirectoryHandlerName)) {
        path = path.slice(maybeDirectoryHandlerName.length + sep.length);
        directoryHandler = directoryHandlerMap.get(maybeDirectoryHandlerName);
      } else {
        const db = await openDB();
        const maybeFixedDirectory = await new Promise<
          FileSystemDirectoryHandle | undefined
        >((resolve, reject) => {
          const transaction = db.transaction(
            directoryHandlerStoreKey,
            "readonly"
          );
          const store = transaction.objectStore(directoryHandlerStoreKey);
          const request = store.get(maybeDirectoryHandlerName);
          request.onsuccess = () => {
            resolve(request.result);
          };
          request.onerror = () => {
            reject(request.error);
          };
        }).catch((e) => {
          console.error(e);
          // 握り潰してる
          return undefined;
        });

        if (maybeFixedDirectory === undefined) {
          return Promise.resolve(false);
        }

        if (
          !(await maybeFixedDirectory.requestPermission({ mode: "readwrite" }))
        ) {
          return Promise.resolve(false);
        }

        directoryHandlerMap.set(maybeDirectoryHandlerName, maybeFixedDirectory);
        directoryHandler = maybeFixedDirectory;
      }
    }

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
