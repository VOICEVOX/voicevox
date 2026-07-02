import { describe, expect, it } from "vitest";
import { decibelToLinear } from "@/sing/audio";
import { absoluteVolumeEditMode } from "@/sing/volumeEditMode";
import { ABSOLUTE_VOLUME_MAX_DB } from "@/sing/volumeValueScale";

describe("absoluteVolumeEditMode", () => {
  it("dBを保存値のlinear volumeに変換する", () => {
    expect(absoluteVolumeEditMode.toStoredValue(-6, undefined)).toBeCloseTo(
      decibelToLinear(-6),
    );
  });

  it("dBから保存値への変換は元ボリュームに依存しない", () => {
    expect(absoluteVolumeEditMode.toStoredValue(-6, 0.5)).toBeCloseTo(
      absoluteVolumeEditMode.toStoredValue(-6, undefined),
    );
  });

  it("dBから保存値への変換結果は1を超えない", () => {
    expect(
      absoluteVolumeEditMode.toStoredValue(ABSOLUTE_VOLUME_MAX_DB, undefined),
    ).toBeLessThanOrEqual(1);
  });

  it("非有限のdBはエラーにする", () => {
    expect(() =>
      absoluteVolumeEditMode.toStoredValue(Number.NaN, undefined),
    ).toThrow("db must be finite.");
  });

  it("保存値をそのまま実効値にする", () => {
    expect(absoluteVolumeEditMode.toEffectiveValue(0.5, 0.8)).toBe(0.5);
    expect(absoluteVolumeEditMode.toEffectiveValue(0.5, undefined)).toBe(0.5);
  });

  it("負の保存値の実効値は0にクランプする", () => {
    expect(absoluteVolumeEditMode.toEffectiveValue(-0.1, 0.8)).toBe(0);
  });
});
