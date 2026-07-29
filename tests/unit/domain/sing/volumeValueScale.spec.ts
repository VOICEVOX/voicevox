import { describe, expect, it } from "vitest";
import {
  RELATIVE_VOLUME_MAX_DB,
  RELATIVE_VOLUME_MIN_DB,
  relativeVolumeValueScale,
} from "@/sing/volumeValueScale";

describe("volumeValueScale", () => {
  it("normalizedYをdBオフセットに変換する", () => {
    expect(relativeVolumeValueScale.normalizedYToDb(0)).toBe(
      RELATIVE_VOLUME_MIN_DB,
    );
    expect(relativeVolumeValueScale.normalizedYToDb(0.5)).toBe(0);
    expect(relativeVolumeValueScale.normalizedYToDb(1)).toBe(
      RELATIVE_VOLUME_MAX_DB,
    );
  });

  it("dBオフセットをnormalizedYに変換する", () => {
    expect(relativeVolumeValueScale.dbToNormalizedY(0)).toBe(0.5);
    expect(relativeVolumeValueScale.dbToNormalizedY(-6)).toBeCloseTo(0.25);
  });

  it("dBを符号付きラベルに整形する", () => {
    expect(relativeVolumeValueScale.formatDbLabel(6)).toBe("+6.0");
    expect(relativeVolumeValueScale.formatDbLabel(-6)).toBe("-6.0");
    expect(relativeVolumeValueScale.formatDbLabel(0)).toBe("0.0");
    expect(relativeVolumeValueScale.formatDbLabel(-0.04)).toBe("0.0");
  });

  it("相対ボリューム用グリッド線を定義する", () => {
    expect(
      relativeVolumeValueScale.gridLines
        .filter((line) => line.kind !== "minor")
        .map((line) => line.label),
    ).toEqual(["+12", "+6", "0", "-6", "-12"]);
    expect(
      relativeVolumeValueScale.gridLines
        .filter((line) => line.kind === "minor")
        .map((line) => line.db),
    ).toEqual([9, 3, -3, -9]);
    const baseline = relativeVolumeValueScale.gridLines.find(
      (line) => line.kind === "baseline",
    );
    expect(baseline?.db).toBe(0);
    expect(baseline?.labelOnly).toBeUndefined();
    expect(
      relativeVolumeValueScale.gridLines
        .filter((line) => line.labelOnly !== true)
        .map((line) => line.label),
    ).toEqual(["+9", "+6", "+3", "0", "-3", "-6", "-9"]);
  });
});
