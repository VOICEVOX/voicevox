import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from "electron";
import log from "electron-log/main";
import { IpcIHData, IpcSOData } from "@/type/ipc";

export function ipcMainHandle<T extends keyof IpcIHData>(
  channel: T,
  listener: (
    event: IpcMainInvokeEvent,
    ...args: IpcIHData[T]["args"]
  ) => IpcIHData[T]["return"] | Promise<IpcIHData[T]["return"]>,
): void;
export function ipcMainHandle(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
): void {
  const errorHandledListener = (
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ) => {
    try {
      validateIpcSender(event);
      return listener(event, ...args);
    } catch (e) {
      log.error(e);
    }
  };
  ipcMain.handle(channel, errorHandledListener);
}

export function ipcMainSend<T extends keyof IpcSOData>(
  win: BrowserWindow,
  channel: T,
  ...args: IpcSOData[T]["args"]
): void;
export function ipcMainSend(
  win: BrowserWindow,
  channel: string,
  ...args: unknown[]
): void {
  win.webContents.send(channel, ...args);
}

/** IPCメッセージの送信元を確認する */
const validateIpcSender = (event: IpcMainInvokeEvent) => {
  let isValid: boolean;
  const senderUrl = new URL(event.senderFrame.url);
  if (process.env.VITE_DEV_SERVER_URL != undefined) {
    const devServerUrl = new URL(process.env.VITE_DEV_SERVER_URL);
    isValid = senderUrl.origin === devServerUrl.origin;
  } else {
    isValid = senderUrl.protocol === "app:";
  }
  if (!isValid) {
    throw new Error(
      `不正なURLからのIPCメッセージを検出しました。senderUrl: ${senderUrl.toString()}`,
    );
  }
};
