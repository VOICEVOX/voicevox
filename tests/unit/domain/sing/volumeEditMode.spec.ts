import { describe, expect, it } from "vitest";
import { decibelToLinear } from "@/sing/audio";
import {
  currentVolumeEditMode,
  relativeVolumeEditMode,
} from "@/sing/volumeEditMode";
import {
  RELATIVE_VOLUME_MAX_DB,
  RELATIVE_VOLUME_MIN_DB,
  relativeVolumeValueScale,
} from "@/sing/volumeValueScale";

describe("relativeVolumeEditMode", () => {
  it("現在の編集モードとして使用される", () => {
    expect(currentVolumeEditMode).toBe(relativeVolumeEditMode);
  });

  it("相対スケールと組で定義されている", () => {
    expect(relativeVolumeEditMode.valueScale).toBe(relativeVolumeValueScale);
  });

  it("dBオフセットを保存値の倍率に変換する", () => {
    expect(relativeVolumeEditMode.toStoredValue(0)).toBe(1);
    expect(relativeVolumeEditMode.toStoredValue(-6)).toBeCloseTo(
      decibelToLinear(-6),
    );
  });

  it("保存値は常に正になり、データなしを示す値と衝突しない", () => {
    expect(
      relativeVolumeEditMode.toStoredValue(RELATIVE_VOLUME_MIN_DB),
    ).toBeGreaterThan(0);
  });

  it("非有限のdBはエラーにする", () => {
    expect(() => relativeVolumeEditMode.toStoredValue(Number.NaN)).toThrow(
      "db must be finite.",
    );
  });
  it("保存値をスケール範囲内にクランプする", () => {
    expect(relativeVolumeEditMode.clampStoredValue(100)).toBeCloseTo(
      decibelToLinear(RELATIVE_VOLUME_MAX_DB),
    );
    expect(relativeVolumeEditMode.clampStoredValue(0.001)).toBeCloseTo(
      decibelToLinear(RELATIVE_VOLUME_MIN_DB),
    );
    expect(relativeVolumeEditMode.clampStoredValue(1)).toBe(1);
  });

  it("保存値の間をdB空間で線形補間する", () => {
    expect(
      relativeVolumeEditMode.interpolateStoredValues(
        0,
        decibelToLinear(-6),
        2,
        decibelToLinear(0),
        1,
      ),
    ).toBeCloseTo(decibelToLinear(-3));
  });
});
