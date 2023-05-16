import { describe, expect, it } from "vitest";

import { mapUndefinedPipe, undefinedToDefault } from "@/helpers/map";

type DummyType = {
  outerValue?: {
    innerValue?: string;
  };
};

describe("mapUndefinedPipe", () => {
  it("値をunwrap出来る", () => {
    const key = "test";
    const innerValue = "value";
    const value: DummyType = {
      outerValue: {
        innerValue,
      },
    };
    const map = new Map<string, DummyType>([[key, value]]);
    expect(
      mapUndefinedPipe(
        map.get(key),
        (v) => v.outerValue,
        (v) => v.innerValue
      )
    ).toEqual(innerValue);
  });

  it("途中でundefinedを返すとその後undefinedを返す", () => {
    const key = "test";
    const value: DummyType = {
      outerValue: {
        innerValue: undefined,
      },
    };
    const map = new Map<string, DummyType>([[key, value]]);
    expect(
      mapUndefinedPipe(
        map.get(key),
        (v) => v.outerValue,
        (v) => v.innerValue
      )
    ).toBeUndefined();
  });
});

describe("undefinedToDefault", () => {
  it("値がある時はそのまま返す", () => {
    const actualValue = "value";
    expect(undefinedToDefault("test", actualValue)).toEqual(actualValue);
  });

  it("値がない時はdefaultValueを返す", () => {
    const defaultValue = "test";
    expect(undefinedToDefault(defaultValue, undefined)).toEqual(defaultValue);
  });

  it("undefinedのみを値がない状態とみなす", () => {
    const defaultValue = "test";
    expect(undefinedToDefault(defaultValue, null)).toBeNull();
  });
});
