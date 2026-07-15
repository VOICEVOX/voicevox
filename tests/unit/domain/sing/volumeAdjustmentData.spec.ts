import { describe, expect, it } from "vitest";
import { isValidVolumeAdjustmentData } from "@/sing/domain";

describe("isValidVolumeAdjustmentData", () => {
  it("有限のdB変更量とnullを受け入れる", () => {
    expect(isValidVolumeAdjustmentData([-12, -1, 0, 12, null])).toBe(true);
  });

  it("非有限のdB変更量を拒否する", () => {
    expect(isValidVolumeAdjustmentData([Number.NaN])).toBe(false);
    expect(isValidVolumeAdjustmentData([Number.POSITIVE_INFINITY])).toBe(false);
  });
});
