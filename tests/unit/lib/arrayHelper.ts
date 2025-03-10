import { describe, expect, test } from "vitest";
import {
  flatWithSeparator,
  removeNullableAndBoolean,
} from "@/helpers/arrayHelper";

describe("flatWithSeparator", () => {
  test("配列が空の場合", () => {
    expect(flatWithSeparator([], 0)).toEqual([]);
  });

  test("配列が1つの要素のみの場合", () => {
    expect(flatWithSeparator([[1]], 0)).toEqual([1]);
  });

  test("配列が2つ以上の要素の場合", () => {
    expect(flatWithSeparator([[1], [2], [3]], 0)).toEqual([1, 0, 2, 0, 3]);
  });
});

describe("removeNonValue", () => {
  test("配列が空の場合", () => {
    expect(removeNullableAndBoolean([])).toEqual([]);
  });

  test("配列にnull, undefined, false, trueが含まれる場合", () => {
    expect(
      removeNullableAndBoolean([1, null, 2, undefined, 3, false, 4, true, 5]),
    ).toEqual([1, 2, 3, 4, 5]);
  });
});
