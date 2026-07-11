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

  it("保存値をdBに変換する", () => {
    expect(absoluteVolumeValueScale.valueToDb(1)).toBe(0);
  });

  it("0の保存値はdB変換と表示スケールの合成で表示下端に変換する", () => {
    const db = absoluteVolumeValueScale.valueToDb(0);

    expect(absoluteVolumeValueScale.dbToNormalizedY(db)).toBe(0);
  });

  it("表示範囲を超える保存値はdB変換と表示スケールの合成で表示上端に変換する", () => {
    const db = absoluteVolumeValueScale.valueToDb(2);

    expect(absoluteVolumeValueScale.dbToNormalizedY(db)).toBe(1);
  });

  it("負の保存値はエラーにする", () => {
    expect(() => absoluteVolumeValueScale.valueToDb(-1)).toThrow(
      "value must be greater than or equal to 0.",
    );
  });

  it("非有限の保存値はエラーにする", () => {
    expect(() => absoluteVolumeValueScale.valueToDb(Number.NaN)).toThrow(
      "value must be finite.",
    );
  });

  it("dBをラベル文字列に整形する", () => {
    expect(absoluteVolumeValueScale.formatDbLabel(-6)).toBe("-6.0");
    expect(absoluteVolumeValueScale.formatDbLabel(-12.34)).toBe("-12.3");
    // スケール上端はグリッドラベルの「0」と表記を揃える
    expect(absoluteVolumeValueScale.formatDbLabel(ABSOLUTE_VOLUME_MAX_DB)).toBe(
      "0.0",
    );
  });

  it("絶対ボリューム用グリッド線を定義する", () => {
    expect(
      absoluteVolumeValueScale.gridLines.map((line) => line.label),
    ).toEqual(["0", "-6", "-12", "-18", "-24", "-30", "-36"]);
    expect(absoluteVolumeValueScale.gridLines[0].labelOnly).toBe(true);
    expect(absoluteVolumeValueScale.gridLines.at(-1)?.labelOnly).toBe(true);
    expect(
      absoluteVolumeValueScale.gridLines
        .filter((line) => line.kind !== "minor")
        .map((line) => line.label),
    ).toEqual(["0", "-12", "-24", "-36"]);
  });
});
