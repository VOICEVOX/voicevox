export type Result<T, E extends string = string> =
  | SuccessResult<T>
  | FailureResult<E>;
export const success = <T>(value: T): SuccessResult<T> => ({ ok: true, value });
export type SuccessResult<T> = { ok: true; value: T };
type Failure = {
  (error: Error): FailureResult<typeof unknownCode>;
  <C extends string | undefined>(code: C, error: Error): FailureResult<
    C extends string ? C : typeof unknownCode
  >;
};
const unknownCode = "UNKNOWN" as const;
export const failure: Failure = <C extends string>(
  codeOrError: C | undefined | Error,
  error?: Error
) => {
  switch (typeof codeOrError) {
    case "undefined": {
      if (error === undefined) {
        throw new Error("Error must be specified");
      }

      return {
        ok: false as const,
        code: unknownCode,
        error: error,
      };
    }
    case "string": {
      if (error === undefined) {
        throw new Error("Error must be specified");
      }

      return { ok: false as const, code: codeOrError, error };
    }
    case "object": {
      return {
        ok: false as const,
        code: unknownCode,
        error: codeOrError,
      };
    }
    default: {
      throw new Error("Error must be specified");
    }
  }
};
export class ResultError<E extends string = string> extends Error {
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
export type FailureResult<E> = {
  ok: false;
  code: E;
  error: Error;
};
