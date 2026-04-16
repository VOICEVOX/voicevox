import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";

export type VolumeEditableFrameRange = {
  readonly startFrame: number;
  readonly endFrame: number;
};

export const mergeVolumeEditableFrameRanges = (
  ranges: readonly VolumeEditableFrameRange[],
) => {
  const sorted = [...ranges]
    .filter((range) => range.startFrame < range.endFrame)
    .sort((a, b) => a.startFrame - b.startFrame);

  const merged: { startFrame: number; endFrame: number }[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last == undefined || last.endFrame < range.startFrame) {
      merged.push({ ...range });
      continue;
    }
    last.endFrame = Math.max(last.endFrame, range.endFrame);
  }
  return merged;
};

export const isFrameInVolumeEditableRange = (
  frame: number,
  ranges: readonly VolumeEditableFrameRange[],
) => {
  return ranges.some(
    (range) => range.startFrame <= frame && frame < range.endFrame,
  );
};

export const getOverlappingVolumeEditableFrameRanges = (
  startFrame: number,
  frameLength: number,
  ranges: readonly VolumeEditableFrameRange[],
) => {
  if (frameLength < 1) {
    return [];
  }

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
    if (overlapStart < overlapEnd) {
      overlaps.push({
        startFrame: overlapStart,
        endFrame: overlapEnd,
      });
    }
  }
  return overlaps;
};

export const maskVolumeEditDataByEditableRanges = (
  data: readonly number[],
  startFrame: number,
  ranges: readonly VolumeEditableFrameRange[],
) => {
  const masked = new Array<number>(data.length).fill(VALUE_INDICATING_NO_DATA);
  for (const overlap of getOverlappingVolumeEditableFrameRanges(
    startFrame,
    data.length,
    ranges,
  )) {
    const startIndex = overlap.startFrame - startFrame;
    const endIndex = overlap.endFrame - startFrame;
    for (let i = startIndex; i < endIndex; i++) {
      masked[i] = data[i];
    }
  }
  return masked;
};

export const countVolumeEditDataPoints = (data: readonly number[]) => {
  return data.filter((value) => value !== VALUE_INDICATING_NO_DATA).length;
};

/**
 * 解決済みフレーズ情報からボリューム編集可能区間を計算する。
 * 呼び出し側でトラックフィルタやphraseQuery解決を済ませたうえで渡すこと。
 */
export const computeVolumeEditableFrameRanges = (
  resolvedPhrases: readonly {
    readonly startTime: number;
    readonly volumeLength: number;
    readonly minNonPauseStartFrame?: number;
    readonly maxNonPauseEndFrame?: number;
  }[],
  frameRate: number,
): VolumeEditableFrameRange[] => {
  const ranges: VolumeEditableFrameRange[] = [];
  for (const phrase of resolvedPhrases) {
    const phraseStartFrame = Math.round(phrase.startTime * frameRate);
    const phraseEndFrame = phraseStartFrame + phrase.volumeLength;
    const startFrame = Math.max(
      0,
      phraseStartFrame + (phrase.minNonPauseStartFrame ?? 0),
    );
    const endFrame = Math.min(
      phraseEndFrame,
      phraseStartFrame + (phrase.maxNonPauseEndFrame ?? phrase.volumeLength),
    );
    if (startFrame < endFrame) {
      ranges.push({ startFrame, endFrame });
    }
  }
  return mergeVolumeEditableFrameRanges(ranges);
};
