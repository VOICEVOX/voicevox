import { describe, it, expect } from "vitest";
import { errorToMessage } from "@/helpers/errorHelper";

describe("errorToMessage", () => {
  it("Errorインスタンス", () => {
    const input = new Error("error instance");
    const expected = "error instance";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("SyntaxErrorインスタンス", () => {
    const input = new SyntaxError("syntax error instance");
    const expected = "SyntaxError: syntax error instance";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("自作エラーインスタンス", () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "CustomError";
      }
    }
    const input = new CustomError("custom error instance");
    const expected = "CustomError: custom error instance";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("AggregateErrorインスタンス", () => {
    const input = new AggregateError(
      [new Error("error1"), new Error("error2")],
      "aggregate error",
    );
    const expected = "aggregate error\nerror1\nerror2";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("cause付きエラーインスタンス", () => {
    const input = new Error("error instance", { cause: new Error("cause") });
    const expected = "error instance\ncause";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("文字列エラー", () => {
    const input = "string error";
    const expected = "Unknown Error: string error";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("オブジェクトエラー", () => {
    const input = { key: "value" };
    const expected = 'Unknown Error: {"key":"value"}';
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("不明なエラー", () => {
    const input = undefined;
    const expected = "Unknown Error: undefined";
    expect(errorToMessage(input)).toEqual(expected);
  });
});
