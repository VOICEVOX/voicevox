/**
 * Result型。新しいErrorクラスを作らなくてもエラーハンドリングできる。
 *
 * 成功時はsuccess関数を使ってSuccessResultを返し、
 * エラー時はfailure関数を使ってFailureResultを返せば良い。
 *
 * 例：成功時はstringを返し、エラー時はErrorCodeA・ErrorCodeBを返す場合
 *
 * // 関数定義
 * function generateString(): Result<string, "ErrorCodeA" | "ErrorCodeB"> {
 *   // 成功時
 *   return success("ok string");
 *
 *  // エラー時
 *   return failure("ErrorCodeA", new Error("error message A"));
 *   return failure("ErrorCodeB", new Error("error message B"));
 *   return failure(new Error("other error"));
 * }
 *
 * // 使う側
 * const result = generateString();
 * if (result.ok) {
 *  // 成功時の処理
 *   console.log(result.value); // -> "ok string"
 * }
 * else {
 *   // エラー時の処理
 *   console.log(result.code); // -> "ErrorCodeA" | "ErrorCodeB" | undefined
 *   console.log(result.error); // -> Error
 * }
 *
 * // getValueOrThrowを使えばエラー時にResultErrorをthrowし直す
 * const value = getValueOrThrow(result);
 * console.log(value); // -> "ok string"
 *
 * // Promise#thenと組み合わせると綺麗に書ける。
 * const value = await asyncGenerateString().then(getValueOrThrow);
 * console.log(value); // -> "ok string"
 */
export type Result<T, E extends string | undefined = string | undefined> =
  | SuccessResult<T>
  | FailureResult<E>;

/**
 * 成功Result
 */
export type SuccessResult<T> = { ok: true; value: T };

/**
 * 失敗Result
 */
export type FailureResult<E> = {
  ok: false;
  code: E;
  error: Error;
};

/**
 * 成功Resultを返す
 */
export const success = <T>(value: T): SuccessResult<T> => ({ ok: true, value });
type Failure = {
  (error: Error): FailureResult<undefined>;
  <C extends string | undefined>(code: C, error: Error): FailureResult<C>;
};

/**
 * 失敗Resultを返す
 */
export const failure: Failure = <C extends string>(
  codeOrError: C | undefined | Error,
  error?: Error,
) => {
  if (codeOrError instanceof Error) {
    return {
      ok: false as const,
      code: undefined,
      error: codeOrError,
    };
  } else if (codeOrError == undefined || typeof codeOrError === "string") {
    if (error == undefined) {
      throw new Error("Error must be specified");
    }
    return { ok: false as const, code: codeOrError, error };
  } else {
    throw new Error("Error must be specified");
  }
};

export class ResultError<
  E extends string | undefined = string | undefined,
> extends Error {
  public code: E;

  constructor(public readonly result: FailureResult<E>) {
    super(`${result.code}: ${result.error.message}`, { cause: result.error });
    this.code = result.code;
  }
}

/*
 * resultがSuccessResultの場合はvalueを返す
 * resultがFailureResultの場合はResultErrorをthrowする
 **/
export const getValueOrThrow = <T>(result: Result<T>): T | never => {
  if (result.ok) {
    return result.value;
  } else {
    throw new ResultError(result);
  }
};
