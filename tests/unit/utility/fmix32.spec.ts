import { describe, it, expect } from "vitest";
import { fmix32 } from "@/sing/utility";

describe("fmix32", () => {
  it("ハッシュ値は記録した値になる", () => {
    expect([fmix32(1), fmix32(-1)]).toEqual([1364076727, -2114883783]);
  });

  it("符号付き32bit整数を返す", () => {
    for (let value = -1000; value <= 1000; value++) {
      const hash = fmix32(value);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(-2147483648);
      expect(hash).toBeLessThanOrEqual(2147483647);
    }
  });

  it("入力が異なれば出力も異なる", () => {
    const hashes = new Set<number>();
    for (let value = -5000; value <= 5000; value++) {
      hashes.add(fmix32(value));
    }
    expect(hashes.size).toBe(10001);
  });
});
