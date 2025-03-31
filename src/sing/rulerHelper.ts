/**
 * シーケンサーのルーラーに関する共通ロジック
 */
import type { TimeSignature } from "@/store/type";
import {
  getTimeSignaturePositions,
  getMeasureDuration,
  getBeatDuration,
} from "@/sing/domain";
import { tickToBaseX, baseXToTick } from "@/sing/viewHelper";

/**
 * 指定されたティックを直近の拍に合わせる
 * @param ticks スナップ対象のtick位置
 * @param timeSignatures 拍子情報の配列
 * @param tpqn TPQNの値
 * @returns スナップ後のtick位置
 */
export const ticksToSnappedBeat = (
  ticks: number,
  timeSignatures: TimeSignature[],
  tpqn: number,
): number => {
  if (timeSignatures.length === 0) return ticks;

  const tsPositions = getTimeSignaturePositions(timeSignatures, tpqn);
  // 次の拍子の位置
  const nextTsIndex = tsPositions.findIndex((pos: number) => pos > ticks);
  const nextTsPosition = tsPositions[nextTsIndex];
  // 現在の拍子の位置
  const currentTsIndex =
    nextTsIndex === -1 ? tsPositions.length - 1 : nextTsIndex - 1;
  const currentTs = timeSignatures[currentTsIndex];

  // 現在の拍子に基づくグリッドサイズを計算
  const gridSize = getBeatDuration(currentTs.beatType, tpqn);

  // 拍子の開始位置からの相対位置を計算
  const tsPosition = tsPositions[currentTsIndex];
  const relativePosition = ticks - tsPosition;

  // スナップするグリッド位置
  const snappedRelativePosition =
    Math.round(relativePosition / gridSize) * gridSize;
  const snappedPositionTicks = tsPosition + snappedRelativePosition;

  return Math.min(snappedPositionTicks, nextTsPosition);
};

/**
 * 終了tick位置の計算
 * @param timeSignatures 拍子情報の配列
 * @param tsPositions 拍子位置の配列
 * @param numMeasures 表示する小節数
 * @param tpqn TPQNの値
 * @returns 終了tick位置
 */
export const calculateEndTicks = (
  timeSignatures: TimeSignature[],
  tsPositions: number[],
  numMeasures: number,
  tpqn: number,
): number => {
  // 最後の拍子の位置
  const lastTsIndex = timeSignatures.length - 1;
  const lastTs = timeSignatures[lastTsIndex];
  const lastTsPosition = tsPositions[lastTsIndex];
  // 小節の長さ
  const measureDuration = getMeasureDuration(
    lastTs.beats,
    lastTs.beatType,
    tpqn,
  );
  // 小節数
  const measuresFromLastTs = numMeasures - (lastTs.measureNumber - 1);
  // 終了tick位置 = 最後の拍子の位置 + 小節数 * 小節の長さ
  const endTicks = lastTsPosition + measuresFromLastTs * measureDuration;
  return endTicks;
};

/**
 * オフセットX位置からスナップされたTickへの変換
 * @param offsetX オフセットX位置
 * @param offset 表示オフセット
 * @param sequencerZoomX ズーム倍率X
 * @param timeSignatures 拍子情報の配列
 * @param tpqn TPQNの値
 * @returns スナップされたtick位置
 */
export const offsetXToSnappedTick = (
  offsetX: number,
  offset: number,
  sequencerZoomX: number,
  timeSignatures: TimeSignature[],
  tpqn: number,
): number => {
  const baseX = (offset + offsetX) / sequencerZoomX;
  const baseTick = baseXToTick(baseX, tpqn);
  return ticksToSnappedBeat(baseTick, timeSignatures, tpqn);
};

/**
 * 小節情報を計算する
 * @param timeSignatures 拍子情報の配列
 * @param tsPositions 拍子位置の配列
 * @param endTicks 終了tick位置
 * @param tpqn TPQNの値
 * @param sequencerZoomX ズーム倍率X
 * @returns 小節情報の配列
 */
export const calculateMeasureInfos = (
  timeSignatures: TimeSignature[],
  tsPositions: number[],
  endTicks: number,
  tpqn: number,
  sequencerZoomX: number,
) => {
  return timeSignatures.flatMap((timeSignature, i) => {
    // 小節の長さ
    const measureDuration = getMeasureDuration(
      timeSignature.beats,
      timeSignature.beatType,
      tpqn,
    );
    // 次の拍子の位置
    const nextTsPosition =
      i !== timeSignatures.length - 1 ? tsPositions[i + 1] : endTicks;
    // 小節の開始位置と終了位置
    const start = tsPositions[i];
    const end = nextTsPosition;
    // 小節数
    const numMeasures = Math.floor((end - start) / measureDuration);
    return Array.from({ length: numMeasures }, (_, index) => {
      // 小節番号
      const measureNumber = timeSignature.measureNumber + index;
      // 小節の位置
      const measurePosition = start + index * measureDuration;
      // 小節のX位置
      const baseX = tickToBaseX(measurePosition, tpqn);
      return {
        number: measureNumber,
        x: Math.round(baseX * sequencerZoomX),
      };
    });
  });
};

export {
  getTimeSignaturePositions,
  getMeasureDuration,
  getBeatDuration,
  tickToBaseX,
  baseXToTick,
};
