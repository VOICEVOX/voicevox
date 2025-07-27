// TODO: シーケンサ全般で使えるviewHelperとして共通化する
// 現状はルーラーで利用するもののみを定義しており、汎用ヘルパーとしては整理できていません

/**
 * シーケンサーのルーラーに関する共通ロジック
 */
import type { TimeSignature } from "@/domain/project/type";
import {
  getTimeSignaturePositions,
  getMeasureDuration,
  getBeatDuration,
} from "@/sing/domain";
import { tickToBaseX } from "@/sing/viewHelper";

/**
 * 指定されたティックを直近の拍に合わせる
 * @param targetTick スナップ対象のtick位置
 * @param timeSignatures 拍子情報の配列
 * @param tpqn TPQNの値
 * @returns スナップ後のtick位置
 */
export const snapTickToBeat = (
  targetTick: number,
  timeSignatures: TimeSignature[],
  tpqn: number,
): number => {
  if (timeSignatures.length === 0 || tpqn == undefined) return targetTick;

  // 各拍子記号の開始tick位置を計算
  const tsStartTicks = getTimeSignaturePositions(timeSignatures, tpqn);

  // targetTickがどの拍子記号区間に属するかを特定
  const nextTsIndex = tsStartTicks.findIndex(
    (startTick: number) => startTick > targetTick,
  );
  const currentTsIndex =
    nextTsIndex === -1 ? tsStartTicks.length - 1 : nextTsIndex - 1;
  const currentTs = timeSignatures[currentTsIndex];

  // 現在の拍子における1拍あたりのtick数を計算
  const currentBeatDuration = getBeatDuration(currentTs.beatType, tpqn);

  // 現在の拍子記号の開始tick位置を取得
  const currentTsStartTick = tsStartTicks.at(currentTsIndex);
  if (currentTsStartTick == undefined) return targetTick;

  // 現在の拍子記号の開始位置からの相対tick位置を計算
  const tickFromCurrentTsStart = targetTick - currentTsStartTick;

  // 相対tick位置を拍のグリッドにスナップ
  const snappedTickFromCurrentTsStart =
    Math.round(tickFromCurrentTsStart / currentBeatDuration) *
    currentBeatDuration;

  // スナップ後の絶対tick位置を計算
  const snappedTick = currentTsStartTick + snappedTickFromCurrentTsStart;

  // 最後の拍子記号区間かどうかを判定
  const isLastTs = nextTsIndex === -1;

  if (isLastTs) {
    // 最後の拍子記号の場合、上限なし
    return snappedTick;
  } else {
    // 次の拍子記号の開始位置を上限とする
    const nextTsStartTick = tsStartTicks[nextTsIndex];
    return Math.min(snappedTick, nextTsStartTick);
  }
};

/**
 * シーケンサ内の総小節数に対応するtick位置の計算
 * @param timeSignatures 拍子情報の配列
 * @param numMeasures 表示する小節数
 * @param tpqn TPQNの値
 * @returns 最後尾のtick位置
 */
export const getTotalTicks = (
  timeSignatures: TimeSignature[],
  numMeasures: number,
  tpqn: number,
): number => {
  if (timeSignatures.length === 0 || tpqn === 0) {
    return 0;
  }
  // 拍子位置を計算
  const tsPositions = getTimeSignaturePositions(timeSignatures, tpqn);

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

  // 最後尾のtick位置 = 最後の拍子の位置 + 小節数 * 小節の長さ
  const totalTicks = lastTsPosition + measuresFromLastTs * measureDuration;
  return totalTicks;
};

/**
 * 小節情報を計算する
 * @param timeSignatures 拍子情報の配列
 * @param numMeasures 表示する小節数
 * @param tpqn TPQNの値
 * @param sequencerZoomX ズーム倍率X
 * @returns 小節情報の配列
 */
export const calculateMeasureInfos = (
  timeSignatures: TimeSignature[],
  numMeasures: number,
  tpqn: number,
  sequencerZoomX: number,
) => {
  // 拍子位置を計算
  const tsPositions = getTimeSignaturePositions(timeSignatures, tpqn);
  // 終了tick位置を計算
  const lastTicks = getTotalTicks(timeSignatures, numMeasures, tpqn);

  return timeSignatures.flatMap((timeSignature, i) => {
    // 小節の長さ
    const measureDuration = getMeasureDuration(
      timeSignature.beats,
      timeSignature.beatType,
      tpqn,
    );

    // 次の拍子の位置
    const nextTsPosition =
      i !== timeSignatures.length - 1 ? tsPositions[i + 1] : lastTicks;

    // 小節の開始位置と終了位置
    const start = tsPositions[i];
    const end = nextTsPosition;

    // 小節数
    const numMeasuresInThisTs = Math.floor((end - start) / measureDuration);

    return Array.from({ length: numMeasuresInThisTs }, (_, index) => {
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
