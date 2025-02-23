/**
 * IPC通信用の例外メッセージラッパー。
 * 例外メッセージはレンダラーに渡るときに書き換えられてしまうので、メッセージをオブジェクトに詰め直す。
 * ref: https://github.com/electron/electron/issues/24427
 */

import { errorToMessage } from "@/helpers/errorHelper";

/** 例外メッセージ用のオブジェクト */
type IpcResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      message: string;
    };

/** 例外メッセージ用のオブジェクトにラップする */
export async function wrapToIpcResult<T>(
  fn: () => Promise<T> | T,
): Promise<IpcResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, message: errorToMessage(e) };
  }
}

/** 例外メッセージ用のオブジェクトをアンラップし、例外があれば投げる */
export function getOrThrowIpcResult<T>(result: IpcResult<T>): T {
  if (result.ok) {
    return result.value;
  } else {
    throw new Error(result.message);
  }
}
