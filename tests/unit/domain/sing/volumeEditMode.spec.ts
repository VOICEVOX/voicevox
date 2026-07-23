import { describe, expect, it } from "vitest";
import { relativeVolumeEditMode } from "@/sing/volumeEditMode";
import { relativeVolumeValueScale } from "@/sing/volumeValueScale";

describe("relativeVolumeEditMode", () => {
  it("相対スケールと組で定義されている", () => {
    expect(relativeVolumeEditMode.valueScale).toBe(relativeVolumeValueScale);
  });

  it("dBオフセットをそのまま保存値にする", () => {
    expect(relativeVolumeEditMode.toStoredValue(0)).toBe(0);
    expect(relativeVolumeEditMode.toStoredValue(-6)).toBe(-6);
  });
});
