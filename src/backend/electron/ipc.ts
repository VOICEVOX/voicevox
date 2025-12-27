import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import { wrapToTransferableResult } from "./transferableResultHelper";
import { IpcIHData, IpcSOData } from "./ipcType";
import { createLogger } from "@/helpers/log";

const log = createLogger("ipc");

export type IpcMainHandle = {
  [K in keyof IpcIHData]: (
    event: IpcMainInvokeEvent,
    ...args: IpcIHData[K]["args"]
  ) => Promise<IpcIHData[K]["return"]> | IpcIHData[K]["return"];
};

type IpcMainSend = {
  [K in keyof IpcSOData]: (
    win: BrowserWindow,
    ...args: IpcSOData[K]["args"]
  ) => void;
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
      } catch (e) {
        log.error(e);
        return;
      }

      return wrapToTransferableResult(() => listener(event, ...args));
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
