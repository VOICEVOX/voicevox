import { describe, expect, it } from "vitest";
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

  it("dBオフセットをそのまま保存値にする", () => {
    expect(relativeVolumeEditMode.toStoredValue(0)).toBe(0);
    expect(relativeVolumeEditMode.toStoredValue(-6)).toBe(-6);
  });

  it("非有限のdBはエラーにする", () => {
    expect(() => relativeVolumeEditMode.toStoredValue(Number.NaN)).toThrow(
      "db must be finite.",
    );
  });
  it("保存値をスケール範囲内にクランプする", () => {
    expect(relativeVolumeEditMode.clampStoredValue(100)).toBe(
      RELATIVE_VOLUME_MAX_DB,
    );
    expect(relativeVolumeEditMode.clampStoredValue(-100)).toBe(
      RELATIVE_VOLUME_MIN_DB,
    );
    expect(relativeVolumeEditMode.clampStoredValue(0)).toBe(0);
  });

  it("dB変更量を線形補間する", () => {
    expect(relativeVolumeEditMode.interpolateStoredValues(0, -6, 2, 0, 1)).toBe(
      -3,
    );
  });
});
