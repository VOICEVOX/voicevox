import type { VolumeEditValue } from "@/domain/project/type";
import { getOrThrow } from "@/helpers/mapHelper";
import type {
  EditorFrameAudioQuery,
  EditorFrameAudioQueryKey,
  Phrase,
  SingingVolume,
  SingingVolumeKey,
} from "@/store/type";
import type { TrackId } from "@/type/preload";

/** 編集可能なフレーム区間。endFrameは範囲に含まない。歌唱ボリュームのある非pau区間から導出する */
export type VolumeEditableFrameRange = {
  readonly startFrame: number;
  readonly endFrame: number;
};

/** 汎用のフレーム区間。endFrameは範囲に含まない。消去プレビューなど、編集可否とは無関係な範囲に使う */
export type VolumeEditFrameRange = {
  startFrame: number;
  endFrame: number;
};

export type FramewiseVolumeEditData = {
  readonly values: readonly VolumeEditValue[];
  readonly startFrame: number;
};

type VolumeEditablePhrase = Pick<
  Phrase,
  | "trackId"
  | "queryKey"
  | "singingVolumeKey"
  | "startTime"
  | "minNonPauseStartFrame"
  | "maxNonPauseEndFrame"
>;

type DeriveVolumeEditableFrameRangesOptions = {
  readonly phrases: Iterable<VolumeEditablePhrase>;
  readonly phraseQueries: ReadonlyMap<
    EditorFrameAudioQueryKey,
    Pick<EditorFrameAudioQuery, "frameRate">
  >;
  readonly phraseSingingVolumes: ReadonlyMap<SingingVolumeKey, SingingVolume>;
  readonly trackId: TrackId;
  readonly frameRate: number;
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
 * フレーズの歌唱ボリュームが存在し、かつ非pau区間に対応するフレーム範囲を編集可能区間として返す。
 */
export const deriveVolumeEditableFrameRanges = ({
  phrases,
  phraseQueries,
  phraseSingingVolumes,
  trackId,
  frameRate,
}: DeriveVolumeEditableFrameRangesOptions) => {
  const ranges: VolumeEditableFrameRange[] = [];
  for (const phrase of phrases) {
    if (phrase.trackId !== trackId) {
      continue;
    }
    if (phrase.singingVolumeKey == undefined) {
      continue;
    }
    if (phrase.queryKey == undefined) {
      throw new Error("phrase.queryKey is undefined.");
    }
    const phraseQuery = getOrThrow(phraseQueries, phrase.queryKey);
    if (phraseQuery.frameRate !== frameRate) {
      throw new Error(
        "The frame rate between the singing guide and the edit does not match.",
      );
    }
    const phraseSingingVolume = getOrThrow(
      phraseSingingVolumes,
      phrase.singingVolumeKey,
    );
    const phraseStartFrame = Math.round(phrase.startTime * frameRate);
    const phraseEndFrame = phraseStartFrame + phraseSingingVolume.length;
    const startOffset = phrase.minNonPauseStartFrame ?? 0;
    const endOffset = phrase.maxNonPauseEndFrame ?? phraseSingingVolume.length;
    const startFrame = Math.max(0, phraseStartFrame + startOffset);
    const endFrame = Math.min(phraseEndFrame, phraseStartFrame + endOffset);
    if (startFrame < endFrame) {
      ranges.push({ startFrame, endFrame });
    }
  }

  return mergeVolumeEditableFrameRanges(ranges);
};

/**
 * 指定フレームを含む編集可能区間を返す。
 * 区間は半開区間として扱う。
 */
export const findVolumeEditableFrameRange = (
  frame: number,
  ranges: readonly VolumeEditableFrameRange[],
) => {
  return ranges.find(
    (range) => range.startFrame <= frame && frame < range.endFrame,
  );
};

/**
 * 指定フレームが編集可能区間内にあるかを判定する。
 * 区間は半開区間として扱う。
 */
export const isFrameInVolumeEditableRange = (
  frame: number,
  ranges: readonly VolumeEditableFrameRange[],
) => {
  return findVolumeEditableFrameRange(frame, ranges) != undefined;
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
export const maskVolumeEditDataByEditableRanges = (
  data: FramewiseVolumeEditData,
  ranges: readonly VolumeEditableFrameRange[],
) => {
  const masked = new Array<VolumeEditValue>(data.values.length).fill(null);
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
export const countVolumeEditDataPoints = (data: readonly VolumeEditValue[]) => {
  return data.filter((value) => value != null).length;
};
