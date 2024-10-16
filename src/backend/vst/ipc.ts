import { toBytes } from "fast-base64";
import { Routing } from "./type";
import { Metadata } from "@/backend/common/ConfigManager";
import { ShowImportFileDialogOptions, TrackId } from "@/type/preload";
import { createLogger } from "@/domain/frontend/log";
import { UnreachableError } from "@/type/utility";
import { SingingVoiceKey, Track } from "@/store/type";

/*
メモ：
- VSTプラグインとの通信を行うためのファイル。
- 送信はpostMessage、受信はonIpcResponseとonIpcNotificationを使う。
- 通信内容はJSONでやり取りする。
- だいたいの流れ：
  - requestIdを振る（連番、nonce）
  - Promiseを作っておく
  - postMessageでJSONを送信
  - onIpcResponseで受信
  - requestIdを使ってPromiseをresolveする

  - リクエストなしで通知だけ（再生位置の変更など）の場合はonIpcNotificationを使う

- ipcの関数はcreateMessageFunctionで作る
  - これは直接exportするべきではない。必ず間に関数を挟むこと
- 通知はonReceivedIPCMessageで受け取る
 */

declare global {
  interface Window {
    ipc: {
      postMessage: (value: string) => void;
    };
    onIpcResponse: (value: unknown) => void;
    onIpcNotification: (value: unknown) => void;
  }
}

class RustError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RustError";
  }
}

type Notifications = {
  updatePlayingState: boolean;
  updatePosition: number;
};

let nonce = 0;
let handlerInitialized = false;
const notificationReceivers = new Map<string, ((value: unknown) => void)[]>();
const messagePromises = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    name: string;
  }
>();
const initializeMessageHandler = () => {
  log.info("Initializing message handler");
  window.onIpcResponse = (value: unknown) => {
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
  window.onIpcNotification = (value: unknown) => {
    const message = value as {
      type: string;
      payload: unknown;
    };
    const receivers = notificationReceivers.get(message.type);
    if (!receivers) {
      log.warn(`No receiver found for notification: ${message.type}`);
      return;
    }
    log.info(`From plugin: ${message.type}`);
    for (const receiver of receivers) {
      receiver(message.payload);
    }
  };
};

const createMessageFunction = <T, R>(name: string) => {
  return ((arg?: unknown) => {
    if (!window.ipc?.postMessage) {
      throw new UnreachableError(
        "This function should not be called outside of the plugin environment",
      );
    }
    if (!handlerInitialized) {
      handlerInitialized = true;
      initializeMessageHandler();
    }
    const currentNonce = nonce++;
    log.info(`To plugin: ${name}(${currentNonce})`);
    window.ipc.postMessage(
      JSON.stringify({
        requestId: currentNonce,
        inner: {
          type: name,
          payload: arg,
        },
      }),
    );
    const { promise, resolve, reject } = Promise.withResolvers();
    messagePromises.set(currentNonce, { resolve, reject, name });

    return promise as Promise<R>;
  }) as T extends undefined ? () => Promise<R> : (arg: T) => Promise<R>;
};

export type VstPhrase = {
  start: number;
  voice: string;
};

const ipcGetConfig = createMessageFunction<undefined, string | null>(
  "getConfig",
);
const ipcGetProject = createMessageFunction<undefined, string>("getProject");
const ipcSetProject = createMessageFunction<string, void>("setProject");
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

const ipcSetPhrases = createMessageFunction<
  VstPhrase[],
  {
    missingVoices: SingingVoiceKey[];
  }
>("setPhrases");
const ipcSetVoices = createMessageFunction<
  Record<SingingVoiceKey, string>,
  void
>("setVoices");
const ipcSetTracks = createMessageFunction<Record<TrackId, Track>, void>(
  "setTracks",
);
const ipcGetRouting = createMessageFunction<undefined, Routing>("getRouting");
const ipcSetRouting = createMessageFunction<Routing, void>("setRouting");

type Config = Record<string, unknown> & Metadata;
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

export async function setPhrases(phrases: VstPhrase[]) {
  const { missingVoices } = await ipcSetPhrases(phrases);
  return missingVoices;
}

export async function setVoices(voices: Record<SingingVoiceKey, string>) {
  await ipcSetVoices(voices);
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

export function onReceivedIPCMessage<T extends keyof Notifications>(
  name: T,
  callback: (value: Notifications[T]) => void,
) {
  if (!notificationReceivers.has(name)) {
    notificationReceivers.set(name, []);
  }
  notificationReceivers.get(name)?.push(callback as (value: unknown) => void);
}

export async function setTracks(tracks: Record<TrackId, Track>) {
  await ipcSetTracks(tracks);
}

export async function getRouting(): Promise<Routing> {
  return await ipcGetRouting();
}

export async function setRouting(routing: Routing) {
  await ipcSetRouting(routing);
}
