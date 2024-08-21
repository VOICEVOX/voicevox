import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import log from "electron-log/main";
import { IpcMainHandle, IpcMainSend } from "@/type/ipc";

export const ipcMainHandle = new Proxy({} as IpcMainHandle, {
  get:
    (_, channel: string) =>
    (listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => {
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
    },
});

export const ipcMainSend = new Proxy({} as IpcMainSend, {
  get:
    (_, channel: string) =>
    (win: BrowserWindow, ...args: unknown[]) =>
      win.webContents.send(channel, ...args),
});

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
