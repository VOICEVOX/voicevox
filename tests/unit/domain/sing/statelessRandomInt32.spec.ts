import { describe, it, expect } from "vitest";
import { statelessRandomInt32 } from "@/sing/domain";

// -INDEX_RANGE_TO_CHECK から INDEX_RANGE_TO_CHECK - 1 までのindexを確かめる
const INDEX_RANGE_TO_CHECK = 1000;

describe("statelessRandomInt32", () => {
  it("乱数列の値は記録した値になる", () => {
    expect([
      statelessRandomInt32(123456789, 3),
      statelessRandomInt32(2147483647, -1),
      statelessRandomInt32(-2147483648, -2),
    ]).toEqual([-1552952922, 1449607079, -936229137]);
  });

  it("符号付き32bit整数を返す", () => {
    for (
      let index = -INDEX_RANGE_TO_CHECK;
      index < INDEX_RANGE_TO_CHECK;
      index++
    ) {
      const value = statelessRandomInt32(123456789, index);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(-2147483648);
      expect(value).toBeLessThanOrEqual(2147483647);
    }
  });

  it("seedが同じなら、indexが異なると値も異なる", () => {
    const values = new Set<number>();
    for (
      let index = -INDEX_RANGE_TO_CHECK;
      index < INDEX_RANGE_TO_CHECK;
      index++
    ) {
      values.add(statelessRandomInt32(123456789, index));
    }
    expect(values.size).toBe(INDEX_RANGE_TO_CHECK * 2);
  });
});
