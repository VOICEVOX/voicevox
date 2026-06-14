import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";

export type VolumeEditableFrameRange = {
  readonly startFrame: number;
  readonly endFrame: number;
};

export type FramewiseVolumeData = {
  readonly values: readonly number[];
  readonly startFrame: number;
};

/**
 * 編集可能区間をソートし、重なり・隣接する区間をマージする。
 * 入力はソート不要。
 */
export const mergeVolumeEditableFrameRanges = (
  ranges: readonly VolumeEditableFrameRange[],
) => {
  for (const range of ranges) {
    if (range.endFrame <= range.startFrame) {
      throw new Error("endFrame must be greater than startFrame.");
    }
  }

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
 * 編集可能区間外のデータを VALUE_INDICATING_NO_DATA で埋めた新しい配列を返す。
 */
export const maskVolumeEditDataByEditableRanges = (
  data: FramewiseVolumeData,
  ranges: readonly VolumeEditableFrameRange[],
) => {
  const masked = new Array<number>(data.values.length).fill(
    VALUE_INDICATING_NO_DATA,
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

/** データ配列中の有効な編集データ点数（VALUE_INDICATING_NO_DATA でない要素数）を返す。 */
export const countVolumeEditDataPoints = (data: readonly number[]) => {
  return data.filter((value) => value !== VALUE_INDICATING_NO_DATA).length;
};
