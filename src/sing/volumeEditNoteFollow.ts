import type { Note, Tempo } from "@/domain/project/type";
import { decibelToLinear, linearToDecibel } from "@/sing/audio";
import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";
import { secondToTick, tickToSecond } from "@/sing/music";
import { linearInterpolation } from "@/sing/utility";
import type { VolumeEditFrameRange } from "@/sing/volumeEditRanges";

/**
 * ボリューム編集はノートに帰属する表現として扱う。
 * ノートの移動・削除・コピーの際、ノートのtick範囲に対応するフレーム範囲の
 * 編集データを一緒に操作するためのユーティリティ群。
 * エンジン由来の非同期情報（フレーズ等）には依存せず、コマンド実行時に同期的に計算できる。
 *
 * ノートのリサイズでは波形を伸縮せず、変更前後で重なる時間範囲だけを保持する。
 * テンポ変更では楽譜上の位置を保つため、同じtick位置へ編集値を再配置する。
 */

/** 2つの範囲のうち、片方にだけ含まれる区間を返す */
export function getVolumeEditFrameRangeSymmetricDifference(
  first: VolumeEditFrameRange,
  second: VolumeEditFrameRange,
): VolumeEditFrameRange[] {
  const intersectionStart = Math.max(first.startFrame, second.startFrame);
  const intersectionEnd = Math.min(first.endFrame, second.endFrame);
  if (intersectionStart >= intersectionEnd) {
    return [first, second].filter((range) => range.startFrame < range.endFrame);
  }

  return [
    { startFrame: first.startFrame, endFrame: intersectionStart },
    { startFrame: intersectionEnd, endFrame: first.endFrame },
    { startFrame: second.startFrame, endFrame: intersectionStart },
    { startFrame: intersectionEnd, endFrame: second.endFrame },
  ].filter((range) => range.startFrame < range.endFrame);
}

/** ノートのtick範囲を現在のテンポでフレーム範囲へ変換する */
export function noteToVolumeEditFrameRange(
  note: Pick<Note, "position" | "duration">,
  tempos: Tempo[],
  tpqn: number,
  frameRate: number,
): VolumeEditFrameRange {
  const startFrame = Math.max(
    0,
    Math.round(tickToSecond(note.position, tempos, tpqn) * frameRate),
  );
  const endFrame = Math.max(
    startFrame,
    Math.round(
      tickToSecond(note.position + note.duration, tempos, tpqn) * frameRate,
    ),
  );
  return { startFrame, endFrame };
}

/** 範囲の編集値を切り出す。データ範囲外はVALUE_INDICATING_NO_DATAで埋める */
export function sliceVolumeEditData(
  volumeEditData: readonly number[],
  range: VolumeEditFrameRange,
): number[] {
  const values: number[] = [];
  for (let i = range.startFrame; i < range.endFrame; i++) {
    values.push(volumeEditData[i] ?? VALUE_INDICATING_NO_DATA);
  }
  return values;
}

/** 指定した範囲群の編集値をデータなしにした新しい配列を返す */
export function eraseVolumeEditRanges(
  volumeEditData: readonly number[],
  ranges: VolumeEditFrameRange[],
): number[] {
  const result = [...volumeEditData];
  for (const range of ranges) {
    const endFrame = Math.min(range.endFrame, result.length);
    for (let i = range.startFrame; i < endFrame; i++) {
      result[i] = VALUE_INDICATING_NO_DATA;
    }
  }
  return result;
}

/**
 * 編集値列を指定位置に書き込んだ新しい配列を返す。
 * 到着した範囲は既存データを置き換える（データなしも含めて書き込む）。
 */
export function writeVolumeEditSlice(
  volumeEditData: readonly number[],
  startFrame: number,
  values: readonly number[],
): number[] {
  const result = [...volumeEditData];
  const endFrame = startFrame + values.length;
  if (result.length < endFrame) {
    result.push(
      ...new Array<number>(endFrame - result.length).fill(
        VALUE_INDICATING_NO_DATA,
      ),
    );
  }
  for (const [i, value] of values.entries()) {
    result[startFrame + i] = value;
  }
  return result;
}

/**
 * 編集値列を新しい長さにリサンプルする。
 * 倍率はdB空間で補間し、データなしに隣接する位置は最近傍の値を使う。
 * テンポの異なる位置への移動でノートのフレーム長が変わる場合に使用する。
 */
export function resampleVolumeEditValues(
  values: readonly number[],
  newLength: number,
): number[] {
  if (newLength <= 0) {
    return [];
  }
  if (values.length === 0) {
    return new Array<number>(newLength).fill(VALUE_INDICATING_NO_DATA);
  }
  if (values.length === newLength) {
    return [...values];
  }
  if (values.length === 1 || newLength === 1) {
    return new Array<number>(newLength).fill(values[0]);
  }

  const result: number[] = [];
  const scale = (values.length - 1) / (newLength - 1);
  for (let i = 0; i < newLength; i++) {
    result.push(sampleVolumeEditValue(values, i * scale));
  }
  return result;
}

function sampleVolumeEditValue(
  values: readonly number[],
  sourcePosition: number,
): number {
  const clampedPosition = Math.max(
    0,
    Math.min(sourcePosition, values.length - 1),
  );
  const roundedPosition = Math.round(clampedPosition);
  const snappedPosition =
    Math.abs(clampedPosition - roundedPosition) < 1e-8
      ? roundedPosition
      : clampedPosition;
  const lowerIndex = Math.floor(snappedPosition);
  const upperIndex = Math.min(Math.ceil(snappedPosition), values.length - 1);
  const lowerValue = values[lowerIndex];
  const upperValue = values[upperIndex];
  if (
    lowerIndex === upperIndex ||
    lowerValue === VALUE_INDICATING_NO_DATA ||
    upperValue === VALUE_INDICATING_NO_DATA
  ) {
    return values[Math.round(snappedPosition)];
  }
  return decibelToLinear(
    linearInterpolation(
      lowerIndex,
      linearToDecibel(lowerValue),
      upperIndex,
      linearToDecibel(upperValue),
      snappedPosition,
    ),
  );
}

/**
 * テンポ変更前後で同じtick位置になるよう、トラック全体の編集値を再配置する。
 * 配列の末尾はフレーム範囲の終端として写像し、倍率はdB空間で補間する。
 */
export function remapVolumeEditDataForTempoChange(
  volumeEditData: readonly number[],
  previousTempos: readonly Tempo[],
  nextTempos: readonly Tempo[],
  tpqn: number,
  frameRate: number,
): number[] {
  if (volumeEditData.length === 0) {
    return [];
  }
  if (
    previousTempos.length === nextTempos.length &&
    previousTempos.every(
      (tempo, index) =>
        tempo.position === nextTempos[index].position &&
        tempo.bpm === nextTempos[index].bpm,
    )
  ) {
    return [...volumeEditData];
  }

  const sourceEndTick = secondToTick(
    volumeEditData.length / frameRate,
    previousTempos,
    tpqn,
  );
  const destinationLength = Math.max(
    1,
    Math.round(tickToSecond(sourceEndTick, nextTempos, tpqn) * frameRate),
  );

  return Array.from({ length: destinationLength }, (_, destinationFrame) => {
    const tick = secondToTick(destinationFrame / frameRate, nextTempos, tpqn);
    const sourcePosition = tickToSecond(tick, previousTempos, tpqn) * frameRate;
    return sampleVolumeEditValue(volumeEditData, sourcePosition);
  });
}

export type VolumeEditMove = {
  srcRange: VolumeEditFrameRange;
  destRange: VolumeEditFrameRange;
};

/**
 * ノートの移動に合わせて編集データを追随させた新しい配列を返す。
 * 全スライスを切り出してから移動元を消すため、移動同士が重なっても消し合わない。
 * 移動先の既存データはスライスの範囲内で置き換えられる。
 */
export function moveVolumeEditData(
  volumeEditData: readonly number[],
  moves: VolumeEditMove[],
): number[] {
  const slices = moves.map((move) =>
    resampleVolumeEditValues(
      sliceVolumeEditData(volumeEditData, move.srcRange),
      move.destRange.endFrame - move.destRange.startFrame,
    ),
  );
  let result = eraseVolumeEditRanges(
    volumeEditData,
    moves.map((move) => move.srcRange),
  );
  for (const [i, move] of moves.entries()) {
    result = writeVolumeEditSlice(result, move.destRange.startFrame, slices[i]);
  }
  return result;
}
