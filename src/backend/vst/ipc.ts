import { toBase64, toBytes } from "fast-base64";
import { Routing } from "./type";
import { Metadata } from "@/backend/common/ConfigManager";
import { ShowImportFileDialogOptions, TrackId } from "@/type/preload";
import { createLogger } from "@/helpers/log";
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
  engineReady: { port: number };
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
    silent: boolean;
  }
>();
const initializeMessageHandler = () => {
  log.info("Initializing message handler");
  window.onIpcResponse = (value: unknown) => {
    const { requestId, payload } = value as {
      requestId: number;
      payload: { Ok: unknown } | { Err: string };
    };
    const { resolve, reject, name, silent } =
      messagePromises.get(requestId) ?? {};
    if (!resolve || !reject) {
      log.warn(`No promise found for requestId: ${requestId}`);
      return;
    }
    messagePromises.delete(requestId);
    if ("Ok" in payload) {
      if (!silent) {
        log.info(`From plugin: ${name}(${requestId}), Ok`);
      }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMessageFunction = <F extends (arg?: any) => any>(
  name: string,
  options: Partial<{ silent: boolean }> = {},
) => {
  const silent = options?.silent ?? false;
  return (arg?: Parameters<F>[0]) => {
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
    if (!silent) {
      log.info(`To plugin: ${name}(${currentNonce})`);
    }
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
    messagePromises.set(currentNonce, { resolve, reject, name, silent });

    return promise as Promise<ReturnType<F>>;
  };
};

export type VstPhrase = {
  start: number;
  trackId: TrackId;
  voice: string | null;
  notes: VstNote[];
};
export type VstNote = {
  start: number;
  end: number;
  noteNumber: number;
};

const ipcGetConfig = createMessageFunction<() => string | null>("getConfig");
const ipcSetConfig =
  createMessageFunction<(config: string) => void>("setConfig");
const ipcGetProject = createMessageFunction<() => string>("getProject");
const ipcSetProject =
  createMessageFunction<(project: string) => void>("setProject");
const ipcGetProjectName = createMessageFunction<() => string>("getProjectName");
const ipcGetVersion = createMessageFunction<() => string>("getVersion");
const ipcShowImportFileDialog = createMessageFunction<
  (options: ShowImportFileDialogOptions) => string | null
>("showImportFileDialog");
const ipcShowExportFileDialog = createMessageFunction<
  (obj: {
    defaultPath?: string;
    extensionName: string;
    extensions: string[];
    title: string;
  }) => string | null
>("showExportFileDialog");
const ipcShowSaveDirectoryDialog = createMessageFunction<
  (obj: { title: string }) => string | null
>("showSaveDirectoryDialog");
const ipcExportProject = createMessageFunction<() => boolean>("exportProject");

const ipcReadFile = createMessageFunction<(path: string) => string>("readFile");
const ipcWriteFile =
  createMessageFunction<(obj: { path: string; data: string }) => void>(
    "writeFile",
  );
const ipcCheckFileExists =
  createMessageFunction<(path: string) => boolean>("checkFileExists");

const ipcSetPhrases = createMessageFunction<
  (phrases: VstPhrase[]) => {
    missingVoices: SingingVoiceKey[];
  }
>("setPhrases");
const ipcGetVoices =
  createMessageFunction<() => Record<SingingVoiceKey, string>>("getVoices");
const ipcSetVoices =
  createMessageFunction<(voices: Record<SingingVoiceKey, string>) => void>(
    "setVoices",
  );
const ipcSetTracks =
  createMessageFunction<(tracks: Record<TrackId, Track>) => void>("setTracks");
const ipcGetRouting = createMessageFunction<() => Routing>("getRouting");
const ipcSetRouting =
  createMessageFunction<(routing: Routing) => void>("setRouting");

const ipcGetCurrentPosition = createMessageFunction<() => number | null>(
  "getCurrentPosition",
  { silent: true },
);

const ipcStartEngine =
  createMessageFunction<
    (args: { useGpu: boolean; forceRestart: boolean }) => void
  >("startEngine");
const ipcChangeEnginePath =
  createMessageFunction<() => void>("changeEnginePath");

const ipcZoom = createMessageFunction<(factor: number) => void>("zoom");

type Config = Record<string, unknown> & Metadata;
const log = createLogger("vst/ipc");

export async function getConfig(): Promise<Config | undefined> {
  const rawConfig = await ipcGetConfig();
  if (!rawConfig) {
    return undefined;
  }
  return JSON.parse(rawConfig) as Config;
}

export async function setConfig(config: Config) {
  await ipcSetConfig(JSON.stringify(config));
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

export async function getVoices(): Promise<Record<SingingVoiceKey, string>> {
  return await ipcGetVoices();
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

export async function writeFile(filePath: string, buffer: ArrayBuffer) {
  const base64 = await toBase64(new Uint8Array(buffer));
  await ipcWriteFile({ path: filePath, data: base64 });
}

export async function checkFileExists(filePath: string): Promise<boolean> {
  return await ipcCheckFileExists(filePath);
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

export async function getCurrentPosition(): Promise<number | null> {
  return await ipcGetCurrentPosition();
}

export async function startEngine(args: {
  useGpu: boolean;
  forceRestart: boolean;
}) {
  await ipcStartEngine(args);
}

export async function changeEnginePath() {
  await ipcChangeEnginePath();
}

export async function zoom(factor: number) {
  await ipcZoom(factor);
}

export async function showExportFileDialog(obj: {
  defaultPath?: string;
  extensionName: string;
  extensions: string[];
  title: string;
}): Promise<string | undefined> {
  return await ipcShowExportFileDialog(obj).then(
    (result) => result || undefined,
  );
}

export async function showSaveDirectoryDialog(obj: {
  title: string;
}): Promise<string | undefined> {
  return await ipcShowSaveDirectoryDialog(obj).then(
    (result) => result || undefined,
  );
}
