import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from "electron";

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
  ipcMain.handle(channel, listener);
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
