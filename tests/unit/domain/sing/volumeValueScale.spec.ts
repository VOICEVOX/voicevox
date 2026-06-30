import { describe, expect, it } from "vitest";
import { decibelToLinear } from "@/sing/audio";
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

  it("dBを保存値のlinear volumeに変換する", () => {
    expect(
      absoluteVolumeValueScale.dbToValue({
        db: -6,
        frame: 0,
        originalValue: undefined,
      }),
    ).toBeCloseTo(decibelToLinear(-6));
  });

  it("dBから保存値への変換結果は1を超えない", () => {
    expect(
      absoluteVolumeValueScale.dbToValue({
        db: ABSOLUTE_VOLUME_MAX_DB,
        frame: 0,
        originalValue: undefined,
      }),
    ).toBeLessThanOrEqual(1);
  });

  it("非有限のdBはエラーにする", () => {
    expect(() =>
      absoluteVolumeValueScale.dbToValue({
        db: Number.NaN,
        frame: 0,
        originalValue: undefined,
      }),
    ).toThrow("db must be finite.");
  });

  it("0の保存値は表示下端に変換する", () => {
    expect(
      absoluteVolumeValueScale.valueToNormalizedY({
        value: 0,
        frame: 0,
        originalValue: undefined,
      }),
    ).toBe(0);
  });

  it("負の保存値はエラーにする", () => {
    expect(() =>
      absoluteVolumeValueScale.valueToNormalizedY({
        value: -1,
        frame: 0,
        originalValue: undefined,
      }),
    ).toThrow("value must be greater than or equal to 0.");
  });

  it("非有限の保存値はエラーにする", () => {
    expect(() =>
      absoluteVolumeValueScale.valueToNormalizedY({
        value: Number.NaN,
        frame: 0,
        originalValue: undefined,
      }),
    ).toThrow("value must be finite.");
  });

  it("絶対ボリューム用グリッド線を定義する", () => {
    expect(
      absoluteVolumeValueScale.gridLines.map((line) => line.label),
    ).toEqual(["0", "-6", "-12", "-18", "-24", "-30", "-36"]);
    expect(absoluteVolumeValueScale.gridLines[0].drawLine).toBe(false);
    expect(absoluteVolumeValueScale.gridLines.at(-1)?.drawLine).toBe(false);
  });
});
