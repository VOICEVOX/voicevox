import { describe, expect, test } from "vitest";
import { flatWithSeparator } from "@/helpers/flatWithSeparator";

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
