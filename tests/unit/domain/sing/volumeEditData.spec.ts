import { describe, expect, it } from "vitest";
import { isValidVolumeEditData } from "@/sing/domain";

describe("isValidVolumeEditData", () => {
  it("有限のdB変更量とnullを受け入れる", () => {
    expect(isValidVolumeEditData([-12, -1, 0, 12, null])).toBe(true);
  });

  it("非有限のdB変更量を拒否する", () => {
    expect(isValidVolumeEditData([Number.NaN])).toBe(false);
    expect(isValidVolumeEditData([Number.POSITIVE_INFINITY])).toBe(false);
  });

  it("有限な倍率へ変換できないdB変更量を拒否する", () => {
    expect(isValidVolumeEditData([Number.MAX_VALUE])).toBe(false);
  });
});
