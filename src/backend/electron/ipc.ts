import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import { wrapToTransferableResult } from "./transferableResultHelper";
import { BaseIpcData } from "./ipcType";
import { createLogger } from "@/helpers/log";
import { objectEntries } from "@/helpers/typedEntries";

const log = createLogger("ipc");

export type IpcMainHandle<Ipc extends BaseIpcData> = {
  [K in keyof Ipc]: (
    event: IpcMainInvokeEvent,
    ...args: Ipc[K]["args"]
  ) => Promise<Ipc[K]["return"]> | Ipc[K]["return"];
};

export type IpcSendProxy<Ipc extends BaseIpcData> = {
  [K in keyof Ipc]: (...args: Ipc[K]["args"]) => void;
};

export function registerIpcMainHandle<Ipc extends BaseIpcData>(
  listeners: IpcMainHandle<Ipc>,
): void {
  objectEntries(listeners).forEach(([channel, listener]) => {
    const errorHandledListener: typeof listener = (event, ...args) => {
      try {
        validateIpcSender(event);
      } catch (e) {
        log.error(e);
        return;
      }

      return wrapToTransferableResult(() => listener(event, ...args));
    };
    ipcMain.handle(channel as string, errorHandledListener);
  });
}

export const createIpcSendProxy = <Ipc extends BaseIpcData>(
  win: BrowserWindow,
) =>
  new Proxy(
    {},
    {
      get:
        (_, channel: string) =>
        (...args: unknown[]) =>
          win.webContents.send(channel, ...args),
    },
  ) as IpcSendProxy<Ipc>;

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
