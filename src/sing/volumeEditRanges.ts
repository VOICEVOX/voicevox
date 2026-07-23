import type { VolumeAdjustmentValue } from "@/domain/project/type";

export type VolumeEditableFrameRange = {
  readonly startFrame: number;
  readonly endFrame: number;
};

export type FramewiseVolumeAdjustmentData = {
  readonly values: readonly VolumeAdjustmentValue[];
  readonly startFrame: number;
};

/**
 * 編集可能区間をソートし、重なり・隣接する区間をマージする。
 * 入力はソート不要。
 */
export const mergeVolumeEditableFrameRanges = (
  ranges: readonly VolumeEditableFrameRange[],
) => {
  const sorted = [...ranges].sort((a, b) => a.startFrame - b.startFrame);

  const merged: { startFrame: number; endFrame: number }[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last != undefined && last.endFrame >= range.startFrame) {
      last.endFrame = Math.max(last.endFrame, range.endFrame);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
};

/**
 * 指定フレームが編集可能区間内にあるかを判定する。
 * 区間は半開区間として扱う。
 */
export const isFrameInVolumeEditableRange = (
  frame: number,
  ranges: readonly VolumeEditableFrameRange[],
) => {
  return ranges.some(
    (range) => range.startFrame <= frame && frame < range.endFrame,
  );
};

/**
 * 指定範囲と編集可能区間の重なりを返す。
 * rangesはソート済みであること。mergeVolumeEditableFrameRangesの出力を想定。
 */
export const getOverlappingVolumeEditableFrameRanges = (
  startFrame: number,
  frameLength: number,
  ranges: readonly VolumeEditableFrameRange[],
) => {
  const endFrame = startFrame + frameLength;
  const overlaps: { startFrame: number; endFrame: number }[] = [];
  for (const range of ranges) {
    if (range.endFrame <= startFrame) {
      continue;
    }
    if (endFrame <= range.startFrame) {
      break;
    }

    const overlapStart = Math.max(startFrame, range.startFrame);
    const overlapEnd = Math.min(endFrame, range.endFrame);
    overlaps.push({
      startFrame: overlapStart,
      endFrame: overlapEnd,
    });
  }
  return overlaps;
};

/**
 * 編集可能区間外の変更量をnullで埋めた新しい配列を返す。
 */
export const maskVolumeAdjustmentDataByEditableRanges = (
  data: FramewiseVolumeAdjustmentData,
  ranges: readonly VolumeEditableFrameRange[],
) => {
  const masked = new Array<VolumeAdjustmentValue>(data.values.length).fill(
    null,
  );
  for (const overlap of getOverlappingVolumeEditableFrameRanges(
    data.startFrame,
    data.values.length,
    ranges,
  )) {
    const startIndex = overlap.startFrame - data.startFrame;
    const endIndex = overlap.endFrame - data.startFrame;
    for (let i = startIndex; i < endIndex; i++) {
      masked[i] = data.values[i];
    }
  }
  return masked;
};

/** データ配列中の有効なボリューム変更量の数を返す。 */
export const countVolumeAdjustmentDataPoints = (
  data: readonly VolumeAdjustmentValue[],
) => {
  return data.filter((value) => value != null).length;
};
