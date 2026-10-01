/**
 * 音素タイミング編集の各部の高さと間隔、および帯・境界線・ラベルなど各所の寸法
 * SequencerNoteTimingsとSequencerPhonemeTimingsは同じ領域に重ねて描画し、縦位置を一致させる必要があるため、
 * どちらのコンポーネントにも置かず、このファイルで共有する
 * 見た目を一か所で確認・調整できるよう、片方でしか使わない寸法もここにまとめる
 */
export const PHONEME_TIMING_LAYOUT = {
  noteHeightPx: 24,
  rowGapPx: 16,
  bandHeightPx: 32,
  labelGapPx: 8,
  labelHeightPx: 16,
  topPaddingStepPx: 8,
  noteTickHeightPx: 6,
  lyricMinWidthPx: 16,
  bandGapPx: 4,
  narrowBandGapPx: 2,
  narrowBandThresholdPx: 12,
  bandRadiusPx: 6,
  bridgeMinOffsetPx: 6,
  bridgeBendOffsetPx: 4,
  notePositionMinOffsetPx: 1.5,
  notePositionDashPx: 1.5,
  notePositionDashGapPx: 3,
  ghostDashPx: 2,
  ghostDashGapPx: 3,
  handleWidthPx: 4,
  activeHandleWidthPx: 5,
  handleHeightPx: 8,
  activeHandleHeightPx: 12,
  handleRadiusPx: 1.5,
  labelSpacingPx: 1,
  labelMinWidthPx: 8,
  vowelLabelMinSpanPx: 22,
  labelFontSizePx: 13,
  chipPaddingPx: 6,
  chipHeightPx: 20,
} as const;

/**
 * 音素ラベルのフォント指定
 * 子音と母音が近いと、特にkyなど複数文字の子音名が後続の母音ラベルに隠れるため、
 * 子音ラベルの幅を測り、母音ラベルをその右に置いている
 * 測った幅と表示される幅が一致するよう、同じ指定を使う
 */
export const PHONEME_LABEL_FONT = `500 ${PHONEME_TIMING_LAYOUT.labelFontSizePx}px "Unhinted Rounded M+ 1p Medium", sans-serif`;

/**
 * レーンの高さからノート行・音素帯・ラベル行の位置を求める
 * SequencerNoteTimingsとSequencerPhonemeTimingsで共通の位置を使う
 */
export function getPhonemeTimingLayout(height: number) {
  const noteHeight = PHONEME_TIMING_LAYOUT.noteHeightPx;
  const rowGap = PHONEME_TIMING_LAYOUT.rowGapPx;
  const bandHeight = PHONEME_TIMING_LAYOUT.bandHeightPx;
  const labelGap = PHONEME_TIMING_LAYOUT.labelGapPx;
  const labelHeight = PHONEME_TIMING_LAYOUT.labelHeightPx;
  const blockHeight = noteHeight + rowGap + bandHeight + labelGap + labelHeight;
  const step = PHONEME_TIMING_LAYOUT.topPaddingStepPx;
  const noteTop = Math.max(
    step,
    Math.round((height - blockHeight) / (2 * step)) * step,
  );
  const bandTop = noteTop + noteHeight + rowGap;
  return {
    noteTop,
    noteHeight,
    rowGap,
    bandTop,
    bandHeight,
    labelTop: bandTop + bandHeight + labelGap,
  };
}
