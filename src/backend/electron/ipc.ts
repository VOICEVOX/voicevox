import {
  BrowserWindow,
  ipcMain,
  IpcMainInvokeEvent,
  IpcRendererEvent,
} from "electron";
import { IpcIHData, IpcSOData } from "@/type/ipc";
import { createLogger } from "@/helpers/log";

const log = createLogger("ipc");

export type IpcRendererInvoke = {
  [K in keyof IpcIHData]: (
    ...args: IpcIHData[K]["args"]
  ) => Promise<IpcIHData[K]["return"]>;
};

export type IpcMainHandle = {
  [K in keyof IpcIHData]: (
    event: IpcMainInvokeEvent,
    ...args: IpcIHData[K]["args"]
  ) => Promise<IpcIHData[K]["return"]> | IpcIHData[K]["return"];
};

export type IpcMainSend = {
  [K in keyof IpcSOData]: (
    win: BrowserWindow,
    ...args: IpcSOData[K]["args"]
  ) => void;
};

export type IpcRendererOn = {
  [K in keyof IpcSOData]: (
    event: IpcRendererEvent,
    ...args: IpcSOData[K]["args"]
  ) => Promise<IpcSOData[K]["return"]> | IpcSOData[K]["return"];
};

// FIXME: asを使わないようオーバーロードにした。オーバーロードも使わない書き方にしたい。
export function registerIpcMainHandle<T extends IpcMainHandle>(
  listeners: T,
): void;
export function registerIpcMainHandle(listeners: {
  [key: string]: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;
}) {
  Object.entries(listeners).forEach(([channel, listener]) => {
    const errorHandledListener: typeof listener = (event, ...args) => {
      try {
        validateIpcSender(event);
        return listener(event, ...args);
      } catch (e) {
        log.error(e);
      }
    };
    ipcMain.handle(channel, errorHandledListener);
  });
}

export const ipcMainSendProxy = new Proxy(
  {},
  {
    get:
      (_, channel: string) =>
      (win: BrowserWindow, ...args: unknown[]) =>
        win.webContents.send(channel, ...args),
  },
) as IpcMainSend;

/** IPCメッセージの送信元を確認する */
const validateIpcSender = (event: IpcMainInvokeEvent) => {
  let isValid: boolean = false;
  if (event.senderFrame) {
    const senderUrl = new URL(event.senderFrame.url);
    if (import.meta.env.VITE_DEV_SERVER_URL != undefined) {
      const devServerUrl = new URL(import.meta.env.VITE_DEV_SERVER_URL);
      isValid = senderUrl.origin === devServerUrl.origin;
    } else {
      isValid = senderUrl.protocol === "app:";
    }
  }
  if (!isValid) {
    throw new Error(
      `不正なURLからのIPCメッセージを検出しました。senderUrl: ${event.senderFrame?.url}`,
    );
  }
};
