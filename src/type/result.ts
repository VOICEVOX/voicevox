export type Result<T> = SuccessResult<T> | FailureResult;
export const success = <T>(value: T): SuccessResult<T> => ({ ok: true, value });
export type SuccessResult<T> = { ok: true; value: T };
type Failure = {
  (error: Error): FailureResult;
  (code: string | undefined, error: Error): FailureResult;
};
export const failure: Failure = (codeOrError, error?) => {
  const code = typeof codeOrError === "object" ? undefined : codeOrError;
  const err = typeof codeOrError === "object" ? codeOrError : error;

  return { ok: false, code: code || "UNKNOWN", error: err as Error };
};
export class ResultError extends Error {
  public code: string;

  constructor(public readonly result: FailureResult) {
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
export type FailureResult = {
  ok: false;
  code: string;
  error: Error;
};
