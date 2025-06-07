/**
 * IPC通信用の例外メッセージラッパー。
 * 例外メッセージはレンダラーに渡るときに書き換えられてしまうので、メッセージをオブジェクトに詰め直す。
 * ref: https://github.com/electron/electron/issues/24427
 */

import { DisplayableError, errorToMessage } from "@/helpers/errorHelper";

/** 例外メッセージ用のオブジェクト */
export type TransferableResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; isDisplayable: boolean };

/** 例外メッセージ用のオブジェクトにラップする */
export async function wrapToTransferableResult<T>(
  fn: () => Promise<T> | T,
): Promise<TransferableResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return {
      ok: false,
      message: errorToMessage(e),
      isDisplayable: e instanceof DisplayableError,
    };
  }
}

/** 例外メッセージ用のオブジェクトをアンラップし、例外があれば投げる */
export function getOrThrowTransferableResult<T>(
  result: TransferableResult<T>,
): T {
  if (result.ok) {
    return result.value;
  } else {
    if (result.isDisplayable) {
      throw new DisplayableError(result.message);
    } else {
      throw new Error(result.message);
    }
  }
}
