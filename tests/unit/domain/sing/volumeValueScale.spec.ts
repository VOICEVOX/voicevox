import { describe, expect, it } from "vitest";
import {
  ABSOLUTE_VOLUME_MAX_DB,
  ABSOLUTE_VOLUME_MIN_DB,
  absoluteVolumeValueScale,
} from "@/sing/volumeValueScale";

describe("volumeValueScale", () => {
  it("normalizedYを絶対ボリュームdBに変換する", () => {
    expect(absoluteVolumeValueScale.normalizedYToDb(0)).toBe(
      ABSOLUTE_VOLUME_MIN_DB,
    );
    expect(absoluteVolumeValueScale.normalizedYToDb(1)).toBe(
      ABSOLUTE_VOLUME_MAX_DB,
    );
  });

  it("dBをnormalizedYに変換する", () => {
    const actual = absoluteVolumeValueScale.dbToNormalizedY(-18);

    expect(actual).toBeGreaterThan(0);
    expect(actual).toBeLessThan(1);
  });

  it("0の保存値は表示下端に変換する", () => {
    expect(absoluteVolumeValueScale.valueToNormalizedY(0)).toBe(0);
  });

  it("負の保存値はエラーにする", () => {
    expect(() => absoluteVolumeValueScale.valueToNormalizedY(-1)).toThrow(
      "value must be greater than or equal to 0.",
    );
  });

  it("非有限の保存値はエラーにする", () => {
    expect(() =>
      absoluteVolumeValueScale.valueToNormalizedY(Number.NaN),
    ).toThrow("value must be finite.");
  });

  it("絶対ボリューム用グリッド線を定義する", () => {
    expect(
      absoluteVolumeValueScale.gridLines.map((line) => line.label),
    ).toEqual(["0", "-6", "-12", "-18", "-24", "-30", "-36"]);
    expect(absoluteVolumeValueScale.gridLines[0].drawLine).toBe(false);
    expect(absoluteVolumeValueScale.gridLines.at(-1)?.drawLine).toBe(false);
    expect(
      absoluteVolumeValueScale.gridLines
        .filter((line) => line.displayPriority === "primary")
        .map((line) => line.label),
    ).toEqual(["0", "-12", "-24", "-36"]);
  });
});
