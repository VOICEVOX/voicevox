import { type BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import { wrapToTransferableResult } from "./transferableResultHelper";
import type { BaseIpcData } from "./ipcType";
import { createLogger } from "@/helpers/log";
import { objectEntries } from "@/helpers/typedEntries";
import { ensureNotNullish } from "@/type/utility";

/**
 * ipc.ts の設計思想
 *
 * 想定:
 * - アプリは基本的に単一のフロントエンドウィンドウ（または明示的に切り替えられるウィンドウ）を使用する前提。
 * - ウィンドウ切替が行われるケース（welcome <-> main）に対応するため、同一チャネルに複数ハンドラを登録できるが、
 *   実行時には送信元の `webContents.id` とターゲットウィンドウを検証して、適切なハンドラのみを処理する。
 * - 同期/非同期の戻り値は `IpcMainHandle` の定義に従い Promise/値の両方を許容する。
 * - 不正な送信元に対しては明示的にエラーを投げ、ハンドラは処理しない。
 *
 * 設計上の注意点:
 * - マルチウィンドウ同時起動をフルサポートする設計にはなっていないため、将来的に複雑化する場合は
 *   別途チャネル分離やオーソリティチェックを強化すること。
 *
 * 使用例（簡易）:
 * - 型定義側（`ipcType.ts`）でチャネルを定義する
 *   export type MyIpc = IpcIHData & {
 *     MY_CHANNEL: { args: [value: number]; return: string };
 *   };
 * - 登録側: `registerIpcMainHandle<MyIpc>(win, { MY_CHANNEL: (e, v) => v.toString() })`
 *
 * 関連: 型定義は `ipcType.ts` の `IpcIHData` / `IpcSOData` を参照してください。
 */
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

const ipcHandlers = new Map<
  string,
  ((event: IpcMainInvokeEvent, ...args: unknown[]) => unknown)[]
>();
const delegated = Symbol("delegated");
export function registerIpcMainHandle<Ipc extends BaseIpcData>(
  win: BrowserWindow,
  listeners: IpcMainHandle<Ipc>,
): void {
  objectEntries(listeners).forEach(([channel, listener]) => {
    const errorHandledListener: typeof listener = (event, ...args) => {
      if (win.isDestroyed() || event.sender.id !== win.webContents.id) {
        return delegated;
      }
      try {
        validateIpcSender(event);
      } catch (e) {
        log.error(e);
        return;
      }

      return wrapToTransferableResult(() => listener(event, ...args));
    };
    if (ipcHandlers.has(channel as string)) {
      ensureNotNullish(ipcHandlers.get(channel as string)).push(
        errorHandledListener,
      );
    } else {
      ipcHandlers.set(channel as string, [errorHandledListener]);
      ipcMain.handle(channel as string, async (event, ...args: unknown[]) => {
        const handlers = ipcHandlers.get(channel as string);
        if (!handlers) {
          throw new Error(
            `No handlers registered for channel: ${String(channel)}`,
          );
        }
        for (const handler of handlers) {
          const result = await handler(event, ...args);
          if (result !== delegated) {
            return result;
          }
        }
        throw new Error(
          `No valid handler found for channel: ${String(channel)}`,
        );
      });
    }
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
