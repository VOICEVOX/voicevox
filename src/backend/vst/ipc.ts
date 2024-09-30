import { toBytes } from "fast-base64";
import { Metadata } from "@/backend/common/ConfigManager";
import {
  ShowImportFileDialogOptions,
  ShowMessageDialogOptions,
  ShowQuestionDialogOptions,
} from "@/type/preload";
import { createLogger } from "@/domain/frontend/log";
import { UnreachableError } from "@/type/utility";
declare global {
  interface Window {
    sendToPlugin: (value: unknown) => void;
    onPluginMessage: (value: unknown) => void;
  }
}

class RustError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RustError";
  }
}

let nonce = 0;
let handlerInitialized = false;
const messagePromises = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    name: string;
  }
>();
const createMessageFunction = <T, R>(name: string) => {
  return ((arg?: unknown) => {
    if (!window.sendToPlugin) {
      throw new UnreachableError(
        "This function should not be called outside of the plugin environment",
      );
    }
    if (!handlerInitialized) {
      handlerInitialized = true;
      log.info("Initializing message handler");
      window.onPluginMessage = (value: unknown) => {
        const { requestId, payload } = value as {
          requestId: number;
          payload: { Ok: unknown } | { Err: string };
        };
        const { resolve, reject, name } = messagePromises.get(requestId) ?? {};
        if (!resolve || !reject) {
          log.warn(`No promise found for requestId: ${requestId}`);
          return;
        }
        messagePromises.delete(requestId);
        if ("Ok" in payload) {
          log.info(`From plugin: ${name}(${requestId}), Ok`);
          resolve(payload.Ok);
        } else {
          log.error(`From plugin: ${name}(${requestId}), Err: ${payload.Err}`);
          reject(new RustError(payload.Err));
        }
      };
    }
    const currentNonce = nonce++;
    log.info(`To plugin: ${name}(${currentNonce})`);
    window.sendToPlugin({
      requestId: currentNonce,
      inner: {
        type: name,
        payload: arg,
      },
    });
    const { promise, resolve, reject } = Promise.withResolvers();
    messagePromises.set(currentNonce, { resolve, reject, name });

    return promise as Promise<R>;
  }) as T extends undefined ? () => Promise<R> : (arg: T) => Promise<R>;
};

const ipcGetConfig = createMessageFunction<undefined, string | null>(
  "getConfig",
);
const ipcGetProject = createMessageFunction<undefined, string>("getProject");
const ipcSetProject = createMessageFunction<string, undefined>("setProject");
const ipcGetProjectName = createMessageFunction<undefined, string>(
  "getProjectName",
);
const ipcGetVersion = createMessageFunction<undefined, string>("getVersion");
const ipcShowImportFileDialog = createMessageFunction<
  ShowImportFileDialogOptions,
  string | null
>("showImportFileDialog");
const ipcReadFile = createMessageFunction<string, string>("readFile");
const ipcExportProject = createMessageFunction<undefined, boolean>(
  "exportProject",
);
const ipcShowMessageDialog = createMessageFunction<
  {
    type: "none" | "info" | "error" | "question" | "warning";
    title: string;
    message: string;
  },
  void
>("showMessageDialog");
const ipcShowQuestionDialog = createMessageFunction<
  {
    type: "none" | "info" | "error" | "question" | "warning";
    title: string;
    message: string;
    buttons: string[];
    cancelId?: number;
    defaultId?: number;
  },
  number
>("showQuestionDialog");

type Config = Record<string, unknown> & Metadata;
type VstPhrase = {
  start: number;
  end: number;
  hash: number;
};
const log = createLogger("vst/ipc");

export async function getConfig(): Promise<Config> {
  const rawConfig = await ipcGetConfig();
  if (!rawConfig) {
    // TODO: エラーメッセージを表示する
    throw new Error("Failed to get config");
  }

  return JSON.parse(rawConfig) as Config;
}

export async function getProject(): Promise<string> {
  return await ipcGetProject();
}

export async function setProject(memory: string) {
  await ipcSetProject(memory);
}

export async function getPhrases(): Promise<Map<string, VstPhrase>> {
  throw new Error("Not implemented");
  // log.info("getPhrases");
  // const rawPhrases = await vstGetPhrases();
  // return new Map(Object.entries(rawPhrases));
}

export async function updatePhrases(remove: string[], add: unknown[]) {
  throw new Error("Not implemented");
  // log.info(`updatePhrases, remove: ${remove.length}, add: ${add.length}`);
  // await vstUpdatePhrases(remove, add);
}

export async function clearPhrases() {
  throw new Error("Not implemented");
  // log.info("clearPhrases");
  // await vstClearPhrases();
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

export async function showImportFileDialog(
  options: ShowImportFileDialogOptions,
): Promise<string | undefined> {
  return await ipcShowImportFileDialog(options).then(
    (result) => result || undefined,
  );
}

export async function readFile(filePath: string): Promise<ArrayBuffer> {
  const base64 = await ipcReadFile(filePath);
  const uint8array = await toBytes(base64);
  return uint8array.buffer;
}

export async function getProjectName(): Promise<string> {
  return await ipcGetProjectName();
}

export async function getVersion(): Promise<string> {
  return await ipcGetVersion();
}

export async function exportProject(): Promise<
  "success" | "cancelled" | "error"
> {
  return await ipcExportProject()
    .then((result) => (result ? "success" : "cancelled"))
    .catch(() => "error");
}

export async function showMessageDialog(
  options: ShowMessageDialogOptions,
): Promise<void> {
  return await ipcShowMessageDialog(options);
}

export async function showQuestionDialog(
  options: ShowQuestionDialogOptions,
): Promise<number> {
  return await ipcShowQuestionDialog(options);
}
