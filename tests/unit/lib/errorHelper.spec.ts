import { describe, it, expect } from "vitest";
import { DisplayableError, errorToMessage } from "@/helpers/errorHelper";

describe("errorToMessage", () => {
  it("Errorインスタンス", () => {
    const input = new Error("error instance");
    const expected = "（内部エラーメッセージ）\nerror instance";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("SyntaxErrorインスタンス", () => {
    const input = new SyntaxError("syntax error instance");
    const expected =
      "（内部エラーメッセージ）\nSyntaxError: syntax error instance";
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
    const expected =
      "（内部エラーメッセージ）\nCustomError: custom error instance";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("AggregateErrorインスタンス", () => {
    const input = new AggregateError(
      [new Error("error1"), new Error("error2")],
      "aggregate error",
    );
    const expected =
      "（内部エラーメッセージ）\naggregate error\nerror1\nerror2";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("cause付きエラーインスタンス", () => {
    const input = new Error("error instance", { cause: new Error("cause") });
    const expected = "（内部エラーメッセージ）\nerror instance\ncause";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("文字列エラー", () => {
    const input = "string error";
    const expected = "（内部エラーメッセージ）\nUnknown Error: string error";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("オブジェクトエラー", () => {
    const input = { key: "value" };
    const expected = '（内部エラーメッセージ）\nUnknown Error: {"key":"value"}';
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("不明なエラー", () => {
    const input = undefined;
    const expected = "（内部エラーメッセージ）\nUnknown Error: undefined";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("DisplayableErrorインスタンス", () => {
    const input = new DisplayableError("displayable error instance");
    const expected = "displayable error instance";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("DisplayableError -> Error", () => {
    const input = new DisplayableError("displayable error instance", {
      cause: new Error("cause"),
    });
    const expected =
      "displayable error instance\n（内部エラーメッセージ）\ncause";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("DisplayableError -> DisplayableError", () => {
    const input = new DisplayableError("displayable error instance", {
      cause: new DisplayableError("displayable cause"),
    });
    const expected = "displayable error instance\ndisplayable cause";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("DisplayableError -> Error -> DisplayableError", () => {
    const input = new DisplayableError("displayable error instance", {
      cause: new Error("cause", {
        cause: new DisplayableError("displayable cause"),
      }),
    });
    const expected =
      "displayable error instance\n（内部エラーメッセージ）\ncause\ndisplayable cause";
    expect(errorToMessage(input)).toEqual(expected);
  });

  it("CustomDisplayableErrorインスタンス", () => {
    class CustomDisplayableError extends DisplayableError {}
    const input = new CustomDisplayableError(
      "custom displayable error instance",
    );
    const expected = "custom displayable error instance";
    expect(errorToMessage(input)).toEqual(expected);
  });
});
