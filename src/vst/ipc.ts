import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "@/helpers/binaryHelper";
import { Metadata } from "@/shared/ConfigManager";
import { ShowImportFileDialogOptions } from "@/type/preload";

declare function vstGetConfig(): Promise<string>;
declare function vstGetProject(): Promise<string>;
declare function vstSetProject(value: string): Promise<void>;
declare function vstUpdatePhrases(
  remove: string[],
  add: unknown[]
): Promise<void>;
declare function vstClearPhrases(): Promise<void>;
declare function vstShowImportFileDialog(
  title: string,
  extensions: string[] | undefined
): Promise<string>;
declare function vstReadFile(filePath: string): Promise<string | -1>;

type Config = Record<string, unknown> & Metadata;
const log = (message: string, ...args: unknown[]) => {
  window.electron.logInfo(`[vst/ipc] ${message}`, ...args);
};

export async function getConfig(): Promise<Config> {
  log("getConfig");
  const rawConfig = await vstGetConfig();

  return JSON.parse(rawConfig);
}

export async function getProject(): Promise<string> {
  log("getProject");
  return vstGetProject();
}

export async function setProject(memory: string) {
  log("setProject");
  await vstSetProject(memory);
}

export async function updatePhrases(remove: string[], add: unknown[]) {
  log(`updatePhrases, remove: ${remove.length}, add: ${add.length}`);
  await vstUpdatePhrases(remove, add);
}

export async function clearPhrases() {
  log("clearPhrases");
  await vstClearPhrases();
}

declare global {
  interface Window {
    vstOnFileChosen?: (uuid: string, path: string) => void;
  }
}

const fileChosenCallbacks = new Map<
  string,
  (path: string | undefined) => void
>();

export async function showImportFileDialog(
  options: ShowImportFileDialogOptions
): Promise<string | undefined> {
  log("showImportFileDialog", options);
  if (!window.vstOnFileChosen) {
    window.vstOnFileChosen = (uuid: string, path: string | undefined) => {
      log("vstOnFileChosen", uuid, path);
      const callback = fileChosenCallbacks.get(uuid);
      if (!callback) {
        log("callback not found", uuid);
        return;
      }
      callback(path);
    };
  }
  const uuid = await vstShowImportFileDialog(options.title, options.extensions);

  log("Callback registered", uuid);

  return new Promise((resolve) => {
    fileChosenCallbacks.set(uuid, resolve);
  });
}

export async function readFile(filePath: string): Promise<ArrayBuffer> {
  log("readFile", filePath);
  // エンコード周りの回避としてbase64でパスをやりとりする
  const pathArrayBuffer = new TextEncoder().encode(filePath);
  const pathBase64 = arrayBufferToBase64(pathArrayBuffer);
  const base64 = await vstReadFile(pathBase64);
  if (base64 === -1) {
    throw new Error("Failed to read file");
  }
  return base64ToArrayBuffer(base64);
}
