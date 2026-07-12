import { describe, expect, it } from "vitest";
import { decibelToLinear } from "@/sing/audio";
import { absoluteVolumeEditMode } from "@/sing/volumeEditMode";
import {
  ABSOLUTE_VOLUME_MAX_DB,
  absoluteVolumeValueScale,
} from "@/sing/volumeValueScale";

describe("absoluteVolumeEditMode", () => {
  it("絶対値スケールと組で定義されている", () => {
    expect(absoluteVolumeEditMode.valueScale).toBe(absoluteVolumeValueScale);
  });

  it("dBを保存値のlinear volumeに変換する", () => {
    expect(absoluteVolumeEditMode.toStoredValue(-6)).toBeCloseTo(
      decibelToLinear(-6),
    );
  });

  it("スケール上端のdBの保存値は1を超えない", () => {
    expect(
      absoluteVolumeEditMode.toStoredValue(ABSOLUTE_VOLUME_MAX_DB),
    ).toBeLessThanOrEqual(1);
  });

  it("非有限のdBはエラーにする", () => {
    expect(() => absoluteVolumeEditMode.toStoredValue(Number.NaN)).toThrow(
      "db must be finite.",
    );
  });
});
