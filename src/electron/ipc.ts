import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from "electron";
import { v4 as uuidv4 } from "uuid";
import log from "electron-log";

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
      log.error(e);
    }
  };
  ipcMain.handle(channel, errorHandledListener);
}

export function ipcMainSend<T extends keyof IpcSOData>(
  win: BrowserWindow,
  channel: T,
  ...args: IpcSOData[T]["args"]
): Promise<IpcSOData[T]["return"]>;
export function ipcMainSend(
  win: BrowserWindow,
  channel: string,
  ...args: unknown[]
): Promise<unknown> {
  return new Promise((resolve) => {
    const uuid = uuidv4();

    const listener = (
      _event: Electron.Event,
      _channel: string,
      id: string,
      context: unknown
    ) => {
      if (id !== uuid) return;
      win.webContents.off("ipc-message", listener);
      resolve(context);
    };

    win.webContents.on("ipc-message", listener);
    win.webContents.send(channel, uuid, ...args);
  });
}
