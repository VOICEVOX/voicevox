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
      expectedMessage: "custom error message",
      isDisplayable: false,
    });
  });

  it("エラーをラップし、アンラップ時にthrowされる（非同期）", async () => {
    const result = await wrapToTransferableResult<string>(async () => {
      throw new Error("custom error message");
    });
    expectErrorResult({
      result,
      expectedMessage: "custom error message",
      isDisplayable: false,
    });
  });

  it("DisplayableErrorをラップし、型情報を保持する（同期）", async () => {
    const result = await wrapToTransferableResult<number>(() => {
      throw new DisplayableError("user friendly message");
    });
    expectErrorResult({
      result,
      expectedMessage: "user friendly message",
      isDisplayable: true,
    });
  });

  it("DisplayableErrorをラップし、型情報を保持する（非同期）", async () => {
    const result = await wrapToTransferableResult<string>(async () => {
      throw new DisplayableError("user friendly message");
    });
    expectErrorResult({
      result,
      expectedMessage: "user friendly message",
      isDisplayable: true,
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
    expectedMessage: string;
    isDisplayable: boolean;
  }): void {
    const { result, expectedMessage, isDisplayable } = params;
    expect(result.ok).toBe(false);
    if (result.ok) throw new UnreachableError();

    expect(result.isDisplayable).toBe(isDisplayable);

    let thrownError: Error | null = null;
    try {
      getOrThrowTransferableResult(result);
    } catch (e) {
      thrownError = e as Error;
    }

    expect(thrownError).not.toBe(null);
    expect(thrownError?.message).toContain(expectedMessage);

    if (isDisplayable) {
      expect(thrownError).toBeInstanceOf(DisplayableError);
    } else {
      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError).not.toBeInstanceOf(DisplayableError);
    }
  }
});
