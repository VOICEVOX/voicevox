import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";

export type VolumeEditableFrameRange = {
  readonly startFrame: number;
  readonly endFrame: number;
};

/**
 * 編集可能区間をソートし、重なり・隣接する区間をマージする。
 * 入力はソート不要。無効な区間（startFrame >= endFrame）は除外される。
 */
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

/**
 * 指定フレームが編集可能区間内にあるかを判定する。
 * 区間は半開区間 [startFrame, endFrame) として扱う。
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
 * 指定範囲 [startFrame, startFrame + frameLength) と編集可能区間の重なりを返す。
 * rangesはソート済みであること（mergeVolumeEditableFrameRangesの出力を想定）。
 */
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

/**
 * 編集可能区間外のデータを VALUE_INDICATING_NO_DATA で埋めた新しい配列を返す。
 * 元の配列は変更しない。
 */
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

/** データ配列中の有効な編集データ点数（VALUE_INDICATING_NO_DATA でない要素数）を返す。 */
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
