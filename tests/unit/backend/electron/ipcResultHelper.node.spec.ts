import { describe, it, expect } from "vitest";
import {
  wrapToIpcResult,
  getOrThrowIpcResult,
} from "@/backend/electron/ipcResultHelper";
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
    expect(() => getOrThrowIpcResult(result)).toThrow("custom error message");
  });

  it("非同期エラーもラップし、アンラップ時にthrowされる", async () => {
    const result = await wrapToIpcResult(async () => {
      throw new Error("custom error message");
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new UnreachableError();
    expect(() => getOrThrowIpcResult(result)).toThrow("custom error message");
  });
});
