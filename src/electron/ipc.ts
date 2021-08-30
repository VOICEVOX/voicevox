import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from "electron";
import { logError } from "@/electron/log";

export function ipcMainHandle<T extends keyof IpcIHData>(
  channel: T,
  listener: (
    event: IpcMainInvokeEvent,
    ...args: IpcIHData[T]["args"]
  ) => IpcIHData[T]["return"] | Promise<IpcIHData[T]["return"]>
): void;
export function ipcMainHandle(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
): void {
  const errorHandledListener = (
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ) => {
    try {
      return listener(event, ...args);
    } catch (e) {
      logError(e);
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
  return win.webContents.send(channel, ...args);
}
