import { sep } from "path";
import { directoryHandleStoreKey } from "./contract";
import { openDB } from "./browserConfig";
import { SandboxKey } from "@/type/preload";
import { failure, success } from "@/type/result";
import { createLogger } from "@/domain/frontend/log";

const log = createLogger("fileImpl");

const storeDirectoryHandle = async (
  directoryHandle: FileSystemDirectoryHandle,
): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(directoryHandleStoreKey, "readwrite");
    const store = transaction.objectStore(directoryHandleStoreKey);
    const request = store.put(directoryHandle, directoryHandle.name);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

const fetchStoredDirectoryHandle = async (maybeDirectoryHandleName: string) => {
  const db = await openDB();
  return new Promise<FileSystemDirectoryHandle | undefined>(
    (resolve, reject) => {
      const transaction = db.transaction(directoryHandleStoreKey, "readonly");
      const store = transaction.objectStore(directoryHandleStoreKey);
      const request = store.get(maybeDirectoryHandleName);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
    },
  );
};

// ディレクトリ名をキーとして、Write権限を持ったFileSystemDirectoryHandleを保持する
// writeFileに`ディレクトリ名/ファイル名`の形式でfilePathが渡ってくるため、
// `/`で区切ってディレクトリ名を取得し、そのディレクトリ名をキーとしてdirectoryHandleMapからハンドラを取得し、fileWriteを可能にする
const directoryHandleMap: Map<string, FileSystemDirectoryHandle> = new Map();

const showWritableDirectoryPicker = async (): Promise<
  FileSystemDirectoryHandle | undefined
> =>
  window
    .showDirectoryPicker({
      mode: "readwrite",
    })
    // キャンセルするとエラーが投げられる
    .catch(() => undefined); // FIXME: このままだとダイアログ表示エラーと見分けがつかない

export const showOpenDirectoryDialogImpl: (typeof window)[typeof SandboxKey]["showOpenDirectoryDialog"] =
  async () => {
    const _directoryHandler = await showWritableDirectoryPicker();
    if (_directoryHandler == undefined) {
      return undefined;
    }

    await storeDirectoryHandle(_directoryHandler);

    // NOTE: 同一のディレクトリ名だった場合、後で選択されたディレクトリがそれ移行の処理で使用されるため、意図しない保存が発生するかもしれない
    directoryHandleMap.set(_directoryHandler.name, _directoryHandler);
    return _directoryHandler.name;
  };

// separator 以前の文字列はディレクトリ名として扱う
const resolveDirectoryName = (path: string) => path.split(sep)[0];

// FileSystemDirectoryHandle.getFileHandle では / のような separator が含まれるとエラーになるため、ファイル名のみを抽出している
const resolveFileName = (path: string) => {
  const maybeDirectoryHandleName = resolveDirectoryName(path);
  return path.slice(maybeDirectoryHandleName.length + sep.length);
};

// FileSystemDirectoryHandle.getFileHandle では / のような separator が含まれるとエラーになるため、以下の if 文で separator を除去している
// また separator 以前の文字列はディレクトリ名として扱われ、それを key として directoryHandleMap からハンドラを取得したり、set している
const getDirectoryHandleFromDirectoryPath = async (
  maybeDirectoryPathKey: string,
): Promise<FileSystemDirectoryHandle> => {
  const maybeHandle = directoryHandleMap.get(maybeDirectoryPathKey);

  if (maybeHandle != undefined) {
    return maybeHandle;
  } else {
    // NOTE: fixedDirectoryの場合こっちに落ちる場合がある
    const maybeFixedDirectory = await fetchStoredDirectoryHandle(
      maybeDirectoryPathKey,
    );

    if (maybeFixedDirectory == undefined) {
      throw new Error(
        `フォルダへのアクセス許可がありません。アクセスしようとしたフォルダ名: ${maybeDirectoryPathKey}`,
      );
    }

    if (!(await maybeFixedDirectory.requestPermission({ mode: "readwrite" }))) {
      throw new Error(
        "フォルダへのアクセス許可がありません。ファイルの読み書きのためにアクセス許可が必要です。",
      );
    }

    return maybeFixedDirectory;
  }
};

// NOTE: fixedExportEnabled が有効になっている GENERATE_AND_SAVE_AUDIO action では、ファイル名に加えディレクトリ名も指定された状態でfilePathが渡ってくる
// また GENERATE_AND_SAVE_ALL_AUDIO action では fixedExportEnabled の有効の有無に関わらず、ディレクトリ名も指定された状態でfilePathが渡ってくる
export const writeFileImpl: (typeof window)[typeof SandboxKey]["writeFile"] =
  async (obj: { filePath: string; buffer: ArrayBuffer }) => {
    const path = obj.filePath;

    if (!path.includes(sep)) {
      const aTag = document.createElement("a");
      const blob = URL.createObjectURL(new Blob([obj.buffer]));
      aTag.href = blob;
      aTag.download = path;
      document.body.appendChild(aTag);
      aTag.click();
      document.body.removeChild(aTag);
      URL.revokeObjectURL(blob);
      return success(undefined);
    }

    const fileName = resolveFileName(path);
    const maybeDirectoryHandleName = resolveDirectoryName(path);

    const directoryHandle = await getDirectoryHandleFromDirectoryPath(
      maybeDirectoryHandleName,
    );

    directoryHandleMap.set(maybeDirectoryHandleName, directoryHandle);

    return directoryHandle
      .getFileHandle(fileName, { create: true })
      .then(async (fileHandle) => {
        const writable = await fileHandle.createWritable();
        await writable.write(obj.buffer);
        return writable.close();
      })
      .then(() => success(undefined))
      .catch((e) => {
        return failure(e);
      });
  };

export const checkFileExistsImpl: (typeof window)[typeof SandboxKey]["checkFileExists"] =
  async (file) => {
    const path = file;

    if (!path.includes(sep)) {
      return Promise.resolve(false);
    }

    const fileName = resolveFileName(path);
    const maybeDirectoryHandleName = resolveDirectoryName(path);

    const directoryHandle = await getDirectoryHandleFromDirectoryPath(
      maybeDirectoryHandleName,
    );

    directoryHandleMap.set(maybeDirectoryHandleName, directoryHandle);

    const fileEntries = [];
    for await (const [
      fileOrDirectoryName,
      entry,
    ] of directoryHandle.entries()) {
      if (entry.kind === "file") {
        fileEntries.push(fileOrDirectoryName);
      }
    }

    return Promise.resolve(fileEntries.includes(fileName));
  };

// FileSystemFileHandleを保持するMap。キーは生成した疑似パス。
const fileHandleMap: Map<string, FileSystemFileHandle> = new Map();

// ファイル選択ダイアログを開く
// 返り値はファイルパスではなく、疑似パスを返す
export const showOpenFilePickerImpl = async (options: {
  multiple: boolean;
  fileTypes: {
    description: string;
    accept: Record<string, string[]>;
  }[];
}) => {
  try {
    const handles = await showOpenFilePicker({
      excludeAcceptAllOption: true,
      multiple: options.multiple,
      types: options.fileTypes,
    });
    const paths = [];
    for (const handle of handles) {
      const fakePath = `<browser-dummy-${crypto.randomUUID()}>-${handle.name}`;
      fileHandleMap.set(fakePath, handle);
      paths.push(fakePath);
    }
    return handles.length > 0 ? paths : undefined;
  } catch (e) {
    log.warn(`showOpenFilePicker error: ${e}`);
    return undefined;
  }
};

// 指定した疑似パスのファイルを読み込む
export const readFileImpl = async (filePath: string) => {
  const fileHandle = fileHandleMap.get(filePath);
  if (fileHandle == undefined) {
    return failure(new Error(`ファイルが見つかりません: ${filePath}`));
  }
  const file = await fileHandle.getFile();
  const buffer = await file.arrayBuffer();
  return success(buffer);
};
