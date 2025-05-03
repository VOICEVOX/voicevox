import { describe, it, expect } from "vitest";
import {
  wrapToIpcResult,
  getOrThrowIpcResult,
} from "@/backend/electron/ipcResultHelper";
import { DisplayableError } from "@/helpers/errorHelper";
import { UnreachableError } from "@/type/utility";

describe("ipcResultHelper", () => {
  it("正常値をラップ・アンラップできる", async () => {
    const result = await wrapToIpcResult(() => 42);
    expect(result).toEqual({ ok: true, value: 42 });
    expect(getOrThrowIpcResult(result)).toBe(42);
  });

  it("Promiseをラップ・アンラップできる", async () => {
    const result = await wrapToIpcResult(async () => "abc");
    expect(result).toEqual({ ok: true, value: "abc" });
    expect(getOrThrowIpcResult(result)).toBe("abc");
  });

  it("エラーをラップし、アンラップ時にthrowされる", async () => {
    const result = await wrapToIpcResult(() => {
      throw new Error("custom error message");
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new UnreachableError();
    expect(result.isDisplayable).toBe(false);
    expect(() => getOrThrowIpcResult(result)).toThrow("custom error message");
  });

  it("非同期エラーもラップし、アンラップ時にthrowされる", async () => {
    const result = await wrapToIpcResult(async () => {
      throw new Error("custom error message");
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new UnreachableError();
    expect(result.isDisplayable).toBe(false);
    expect(() => getOrThrowIpcResult(result)).toThrow("custom error message");
  });

  it("DisplayableErrorをラップし、型情報を保持する", async () => {
    const result = await wrapToIpcResult(() => {
      throw new DisplayableError("user friendly message");
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new UnreachableError();
    expect(result.isDisplayable).toBe(true);

    let thrownError: Error | undefined;
    try {
      getOrThrowIpcResult(result);
    } catch (e) {
      thrownError = e as Error;
    }

    expect(thrownError).toBeInstanceOf(DisplayableError);
    expect(thrownError?.message).toContain("user friendly message");
  });

  it("非同期DisplayableErrorもラップし、型情報を保持する", async () => {
    const result = await wrapToIpcResult(async () => {
      throw new DisplayableError("user friendly message");
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new UnreachableError();
    expect(result.isDisplayable).toBe(true);

    let thrownError: Error | undefined;
    try {
      getOrThrowIpcResult(result);
    } catch (e) {
      thrownError = e as Error;
    }

    expect(thrownError).toBeInstanceOf(DisplayableError);
    expect(thrownError?.message).toContain("user friendly message");
  });
});
