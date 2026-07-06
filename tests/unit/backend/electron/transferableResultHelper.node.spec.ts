import { describe, it, expect } from "vitest";
import {
  wrapToTransferableResult,
  getOrThrowTransferableResult,
  type TransferableResult,
} from "@/backend/electron/transferableResultHelper";
import { DisplayableError } from "@/helpers/errorHelper";
import { UnreachableError } from "@/type/utility";

describe("transferableResultHelper", () => {
  it("正常値をラップ・アンラップできる（同期）", async () => {
    const result = await wrapToTransferableResult(() => 42);
    expectSuccessResult(result, 42);
  });

  it("正常値をラップ・アンラップできる（非同期）", async () => {
    const result = await wrapToTransferableResult(async () => "abc");
    expectSuccessResult(result, "abc");
  });

  it("エラーをラップし、アンラップ時にthrowされる（同期）", async () => {
    const result = await wrapToTransferableResult<number>(() => {
      throw new Error("custom error message");
    });
    expectErrorResult({
      result,
      expectedCauses: [
        { isDisplayable: false, message: "custom error message" },
      ],
    });
  });

  it("エラーをラップし、アンラップ時にthrowされる（非同期）", async () => {
    const result = await wrapToTransferableResult<string>(async () => {
      throw new Error("custom error message");
    });
    expectErrorResult({
      result,
      expectedCauses: [
        { isDisplayable: false, message: "custom error message" },
      ],
    });
  });

  it("DisplayableErrorをラップし、型情報を保持する（同期）", async () => {
    const result = await wrapToTransferableResult<number>(() => {
      throw new DisplayableError("user friendly message");
    });
    expectErrorResult({
      result,
      expectedCauses: [
        { isDisplayable: true, message: "user friendly message" },
      ],
    });
  });

  it("DisplayableErrorをラップし、型情報を保持する（非同期）", async () => {
    const result = await wrapToTransferableResult<string>(async () => {
      throw new DisplayableError("user friendly message");
    });
    expectErrorResult({
      result,
      expectedCauses: [
        { isDisplayable: true, message: "user friendly message" },
      ],
    });
  });

  it("DisplayableErrorのcauseをラップし、アンラップ時にcauseとして復元する", async () => {
    const result = await wrapToTransferableResult<string>(async () => {
      throw new DisplayableError("user friendly message", {
        cause: new Error("internal error message"),
      });
    });
    expectErrorResult({
      result,
      expectedCauses: [
        { isDisplayable: true, message: "user friendly message" },
        { isDisplayable: false, message: "internal error message" },
      ],
    });
  });

  /** 正常系の結果を検証する */
  function expectSuccessResult<T>(
    result: TransferableResult<T>,
    expectedValue: T,
  ): void {
    expect(result).toEqual({ ok: true, value: expectedValue });
    expect(getOrThrowTransferableResult(result)).toBe(expectedValue);
  }

  /** 異常系の結果を検証する */
  function expectErrorResult(params: {
    result: TransferableResult<unknown>;
    expectedCauses: { isDisplayable: boolean; message: string }[];
  }): void {
    const { result, expectedCauses } = params;
    expect(result.ok).toBe(false);
    if (result.ok) throw new UnreachableError();

    expect(result.causes).toEqual(expectedCauses);

    let thrownError: Error | null = null;
    try {
      getOrThrowTransferableResult(result);
    } catch (e) {
      thrownError = e as Error;
    }

    expect(thrownError).not.toBe(null);
    expect(thrownError?.message).toContain(expectedCauses[0].message);

    if (expectedCauses[0].isDisplayable) {
      expect(thrownError).toBeInstanceOf(DisplayableError);
    } else {
      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError).not.toBeInstanceOf(DisplayableError);
    }

    const causes = getCauses(thrownError);
    expect(causes).toEqual(expectedCauses.slice(1));
  }

  function getCauses(error: Error | null): {
    isDisplayable: boolean;
    message: string;
  }[] {
    const causes: { isDisplayable: boolean; message: string }[] = [];
    let cause = error?.cause;
    while (cause instanceof Error) {
      causes.push({
        isDisplayable: cause instanceof DisplayableError,
        message: cause.message,
      });
      cause = cause.cause;
    }
    return causes;
  }
});
