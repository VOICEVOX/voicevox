import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "@/helpers/binaryHelper";
import { Metadata } from "@/backend/common/ConfigManager";
import { ShowImportFileDialogOptions } from "@/type/preload";

declare function vstGetConfig(): Promise<string>;
declare function vstGetProject(): Promise<string>;
declare function vstSetProject(value: string): Promise<void>;
declare function vstUpdatePhrases(
  remove: string[],
  add: unknown[],
): Promise<void>;
declare function vstGetPhrases(): Promise<Record<string, VstPhrase>>;
declare function vstClearPhrases(): Promise<void>;
declare function vstShowImportFileDialog(
  title: string,
  extensions: string[] | undefined,
): Promise<string>;
declare function vstReadFile(filePath: string): Promise<string | -1>;
declare function vstGetProjectName(): Promise<string>;
declare function vstGetVersion(): Promise<string>;
declare function vstExportProject(): Promise<string>;

type Config = Record<string, unknown> & Metadata;
type VstPhrase = {
  start: number;
  end: number;
  hash: string;
};
const log = (message: string, ...args: unknown[]) => {
  window.backend.logInfo(`[vst/ipc] ${message}`, ...args);
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

export async function getPhrases(): Promise<Map<string, VstPhrase>> {
  log("getPhrases");
  const rawPhrases = await vstGetPhrases();
  return new Map(Object.entries(rawPhrases));
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
    vstOnExportProjectFinished?: (
      uuid: string,
      result: "cancelled" | "error" | "success",
    ) => void;
  }
}

const fileChosenCallbacks = new Map<
  string,
  (path: string | undefined) => void
>();

const exportProjectCallbacks = new Map<
  string,
  (result: "cancelled" | "error" | "success") => void
>();

export async function showImportFileDialog(
  options: ShowImportFileDialogOptions,
): Promise<string | undefined> {
  log("showImportFileDialog", options);
  if (!window.vstOnFileChosen) {
    window.vstOnFileChosen = (nonce: string, path: string | undefined) => {
      log("vstOnFileChosen", nonce, path);
      const callback = fileChosenCallbacks.get(nonce);
      if (!callback) {
        log("callback not found", nonce);
        return;
      }
      callback(path);
    };
  }
  const nonce = await vstShowImportFileDialog(
    options.title,
    options.extensions,
  );

  const promise = new Promise<string | undefined>((resolve) => {
    fileChosenCallbacks.set(nonce, resolve);
  });
  log("Callback registered", nonce);

  return await promise;
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

export async function getProjectName(): Promise<string> {
  log("getProjectName");
  return vstGetProjectName();
}

export async function getVersion(): Promise<string> {
  log("getVersion");
  return vstGetVersion();
}

export async function exportProject() {
  log("exportProject");
  if (!window.vstOnExportProjectFinished) {
    window.vstOnExportProjectFinished = (
      nonce: string,
      result: "cancelled" | "error" | "success",
    ) => {
      log("vstOnExportProjectFinished", nonce, result);
      const callback = exportProjectCallbacks.get(nonce);
      if (!callback) {
        log("callback not found", nonce);
        return;
      }
      callback(result);
    };
  }
  const nonce = await vstExportProject();

  const promise = new Promise<"cancelled" | "error" | "success">((resolve) => {
    exportProjectCallbacks.set(nonce, resolve);
  });
  log("Callback registered", nonce);

  return await promise;
}
