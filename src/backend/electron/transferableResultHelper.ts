/**
 * IPC通信用の例外メッセージラッパー。
 * 例外メッセージはレンダラーに渡るときに書き換えられてしまうので、メッセージをオブジェクトに詰め直す。
 * ref: https://github.com/electron/electron/issues/24427
 */

import { DisplayableError, errorToMessages } from "@/helpers/errorHelper";
import { assertNonNullable } from "@/type/utility";

/** 例外メッセージ用のオブジェクト */
type TransferableResultCause = { isDisplayable: boolean; message: string };

export type TransferableResult<T> =
  | { ok: true; value: T }
  | { ok: false; causes: TransferableResultCause[] };

/** 例外メッセージ用のオブジェクトにラップする */
export async function wrapToTransferableResult<T>(
  fn: () => Promise<T> | T,
): Promise<TransferableResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    const { displayable, internal } = errorToMessages(e);
    return {
      ok: false,
      causes: [
        ...displayable.map((message) => ({
          isDisplayable: true,
          message,
        })),
        ...internal.map((message) => ({
          isDisplayable: false,
          message,
        })),
      ],
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
    const error = result.causes.reduceRight<Error | undefined>(
      (cause, { isDisplayable, message }) =>
        isDisplayable
          ? new DisplayableError(message, { cause })
          : new Error(message, { cause }),
      undefined,
    );
    assertNonNullable(error);
    throw error;
  }
}
