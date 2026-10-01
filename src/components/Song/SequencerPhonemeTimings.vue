<template>
  <div ref="canvasContainer" class="canvas-container">
    <canvas ref="canvas"></canvas>
    <div
      v-for="label in labels"
      :key="label.key"
      class="phoneme-label"
      :class="{ active: label.active }"
      :style="{
        left: `${label.x}px`,
        top: `${label.y}px`,
        maxWidth: `${label.maxWidth}px`,
      }"
    >
      {{ label.text }}
    </div>
    <div
      v-if="chip"
      class="phoneme-chip"
      :style="{ left: `${chip.x}px`, top: `${chip.y}px` }"
    >
      <span class="phoneme-chip-name">{{ chip.phoneme }}</span>
      <span v-if="chip.deltaMs !== 0" class="phoneme-chip-delta"
        >{{ chip.deltaMs > 0 ? "+" : "" }}{{ chip.deltaMs }} ms</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted, onMounted, toRaw } from "vue";
import * as PIXI from "pixi.js";
import { useStore } from "@/store";
import { useMounted } from "@/composables/useMounted";
import { secondToTick } from "@/song/music";
import { isVowel } from "@/song/domain";
import { tickToBaseX, type ViewportInfo } from "@/song/viewHelper";
import { assertNonNullable } from "@/type/utility";
import type {
  PhonemeTimingPreview,
  PhonemeTimingInfo,
  PhonemeTimingTarget,
} from "@/song/phonemeTimingEditorStateMachine/common";

import {
  buildPhonemeBoundaryDisplays,
  buildNotePhonemeBands,
} from "@/song/phonemeTimingDisplay";
import { createThemeColorResolver } from "@/song/graphics/cssColor";
import type { Color } from "@/song/graphics/lineStrip";
import {
  getPhonemeTimingLayout,
  PHONEME_TIMING_LAYOUT,
  PHONEME_LABEL_FONT,
} from "@/components/Song/SequencerPhonemeTimingEditor/style";

const props = defineProps<{
  viewportInfo: ViewportInfo;
  previewPhonemeTiming?: PhonemeTimingPreview;
  phonemeTimingInfos: PhonemeTimingInfo[];
  activePhoneme?: PhonemeTimingTarget;
}>();

const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const isDark = computed(() => store.state.currentTheme === "Dark");
const tempos = computed(() => store.state.tempos);
const previewPhonemeTiming = computed(() => props.previewPhonemeTiming);
const phonemeTimingInfos = computed(() => props.phonemeTimingInfos);
const editorFrameRate = computed(() => store.state.editorFrameRate);

const resolvePhonemeColors = createThemeColorResolver({
  rowLine: "--scheme-color-song-phoneme-row-line",
  band: "--scheme-color-song-phoneme-band-container",
  bandHover: "--scheme-color-song-phoneme-band-container-hover",
  head: "--scheme-color-song-phoneme-bound-head",
  follow: "--scheme-color-song-phoneme-bound-follow",
  hover: "--scheme-color-song-phoneme-bound-hover",
  edited: "--scheme-color-song-phoneme-bound-edited",
  editing: "--scheme-color-song-phoneme-bound-editing",
  bridge: "--scheme-color-song-phoneme-bridge",
  bridgeHover: "--scheme-color-song-phoneme-bridge-hover",
  ghost: "--scheme-color-song-phoneme-ghost",
  guide: "--scheme-color-song-phoneme-guide",
  notePosition: "--scheme-color-song-phoneme-note-position",
});
const labels = ref<
  {
    key: string;
    x: number;
    y: number;
    text: string;
    active: boolean;
    maxWidth: number;
  }[]
>([]);
const chip = ref<{ x: number; y: number; phoneme: string; deltaMs: number }>();

const toFillStyle = (color: Color) => ({
  color: color.toRgbNumber(),
  alpha: color.toAlphaFloat(),
});

const { mounted } = useMounted();

const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;
let labelTextContext: CanvasRenderingContext2D | undefined;
const labelWidths = new Map<string, number>();

const getLabelWidth = (phoneme: string) => {
  assertNonNullable(labelTextContext);
  let width = labelWidths.get(phoneme);
  if (width == undefined) {
    width = labelTextContext.measureText(phoneme).width;
    labelWidths.set(phoneme, width);
  }
  return width;
};

// TODO: pixi.js関連の変数をまとめてモジュール化し、isUnmountedなどのフラグを無くす
let isUnmounted = false;
let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;

// 音素境界ごとに、境界線・ドラッグ中のガイド線・ハンドルを描くGraphicsのプール
const graphics: PIXI.Graphics[] = [];
// 音素帯・区切り線・ノートとの対応線・破線など、境界線より後ろに描く図形をまとめたGraphics
let bandGraphic: PIXI.Graphics | undefined;
let requestId: number | undefined;
let renderInNextFrame = false;

const render = () => {
  assertNonNullable(renderer);
  assertNonNullable(stage);
  assertNonNullable(canvasWidth);
  assertNonNullable(canvasHeight);
  assertNonNullable(bandGraphic);
  assertNonNullable(canvasContainer.value);

  const viewportWidth = canvasWidth;
  const colors = resolvePhonemeColors(canvasContainer.value, isDark.value);
  const rawTempos = toRaw(tempos.value);
  const preview = previewPhonemeTiming.value;
  const viewport = props.viewportInfo;
  const toScreenX = (seconds: number) =>
    tickToBaseX(secondToTick(seconds, rawTempos, tpqn.value), tpqn.value) *
      viewport.scaleX -
    viewport.offsetX;
  const layout = getPhonemeTimingLayout(canvasHeight);
  const { noteTop, noteHeight, bandTop, bandHeight, labelTop } = layout;
  const bandBottom = bandTop + bandHeight;
  const boundaries = buildPhonemeBoundaryDisplays(
    toRaw(phonemeTimingInfos.value),
    preview,
    editorFrameRate.value,
  );
  const bands = buildNotePhonemeBands(boundaries);
  const target = props.activePhoneme;
  const notePositions = new Map(
    store.getters.SELECTED_TRACK.notes.map((note) => [note.id, note.position]),
  );

  bandGraphic.clear();

  // ノート行と音素帯の間の区切り線
  bandGraphic
    .moveTo(0, bandTop)
    .lineTo(canvasWidth, bandTop)
    .stroke({ width: 1, ...toFillStyle(colors.rowLine) });

  // 音素帯
  // ノートに対応する音素をあらわす帯
  // 操作対象エリアであることも表現する
  for (const band of bands) {
    const startX = toScreenX(band.startTimeSeconds);
    const endX = toScreenX(band.endTimeSeconds);
    if (endX < 0 || startX > canvasWidth) continue;
    const gap =
      endX - startX < PHONEME_TIMING_LAYOUT.narrowBandThresholdPx
        ? PHONEME_TIMING_LAYOUT.narrowBandGapPx
        : PHONEME_TIMING_LAYOUT.bandGapPx;
    const bandColor =
      band.noteId === target?.noteId ? colors.bandHover : colors.band;
    const nonPauBoundaries = band.boundaries.filter(
      (info) => info.phoneme !== "pau",
    );
    for (const [index, info] of nonPauBoundaries.entries()) {
      const cellX = toScreenX(info.displayStartTimeSeconds);
      const next = nonPauBoundaries[index + 1];
      const cellEndX =
        next == undefined
          ? endX - gap
          : toScreenX(next.displayStartTimeSeconds);
      const width = cellEndX - cellX;
      if (width <= 0) continue;
      const radius =
        next == undefined
          ? Math.min(PHONEME_TIMING_LAYOUT.bandRadiusPx, width / 2)
          : 0;
      bandGraphic
        .moveTo(cellX, bandTop)
        .lineTo(cellEndX - radius, bandTop)
        .quadraticCurveTo(cellEndX, bandTop, cellEndX, bandTop + radius)
        .lineTo(cellEndX, bandBottom - radius)
        .quadraticCurveTo(cellEndX, bandBottom, cellEndX - radius, bandBottom)
        .lineTo(cellX, bandBottom)
        .closePath()
        .fill(toFillStyle(bandColor));
    }
  }

  // ノートとの対応線
  // ノートの開始位置から、そのノートの最初の音素境界へ折れ線を引く
  // 子音がノートより前に始まっても、どのノートの音素かを追えるようにする
  // ずれが小さいと折れ線が潰れて見えないため、まっすぐ下ろし、帯の中にノートの位置を破線で示す
  for (const band of bands) {
    const startX = toScreenX(band.startTimeSeconds);
    const notePosition = notePositions.get(band.noteId);
    if (notePosition == undefined) continue;
    const noteX =
      tickToBaseX(notePosition, tpqn.value) * viewport.scaleX -
      viewport.offsetX;
    if (Math.max(noteX, startX) < 0 || Math.min(noteX, startX) > canvasWidth)
      continue;
    const dx = Math.abs(noteX - startX);
    // 同じ時刻のグリッド線と中心を揃える
    const noteLineX = Math.round(noteX) - 0.5;
    const startLineX = Math.round(startX) - 0.5;
    const bridgeColor =
      band.noteId === target?.noteId
        ? preview?.type === "move"
          ? colors.editing
          : colors.bridgeHover
        : colors.bridge;
    const noteBottom = noteTop + noteHeight;
    bandGraphic.moveTo(noteLineX, noteBottom);
    if (dx >= PHONEME_TIMING_LAYOUT.bridgeMinOffsetPx) {
      const bendY = noteBottom + PHONEME_TIMING_LAYOUT.bridgeBendOffsetPx;
      bandGraphic.lineTo(noteLineX, bendY).lineTo(startLineX, bendY);
    }
    bandGraphic
      .lineTo(
        dx < PHONEME_TIMING_LAYOUT.bridgeMinOffsetPx ? noteLineX : startLineX,
        bandTop,
      )
      .stroke({ width: 1, ...toFillStyle(bridgeColor) });
    if (
      dx >= PHONEME_TIMING_LAYOUT.notePositionMinOffsetPx &&
      dx < PHONEME_TIMING_LAYOUT.bridgeMinOffsetPx
    ) {
      for (
        let y = bandTop;
        y < bandBottom;
        y +=
          PHONEME_TIMING_LAYOUT.notePositionDashPx +
          PHONEME_TIMING_LAYOUT.notePositionDashGapPx
      ) {
        bandGraphic
          .moveTo(noteLineX, y)
          .lineTo(
            noteLineX,
            Math.min(y + PHONEME_TIMING_LAYOUT.notePositionDashPx, bandBottom),
          );
      }
      bandGraphic.stroke({
        width: 1,
        ...toFillStyle(colors.notePosition),
      });
    }
  }

  // 元位置
  // 操作対象の境界が編集で動いているとき、編集前の位置を破線で示す
  for (const info of boundaries) {
    const isTarget =
      target?.noteId === info.noteId &&
      target.phonemeIndexInNote === info.phonemeIndexInNote;
    if (!isTarget) continue;
    const originalX = toScreenX(info.originalStartTimeSeconds);
    if (
      info.displayState !== "default" &&
      info.displayStartTimeSeconds !== info.originalStartTimeSeconds
    ) {
      const ghostX = Math.round(originalX) - 0.5;
      for (
        let y = bandTop;
        y < bandBottom;
        y +=
          PHONEME_TIMING_LAYOUT.ghostDashPx +
          PHONEME_TIMING_LAYOUT.ghostDashGapPx
      ) {
        bandGraphic
          .moveTo(ghostX, y)
          .lineTo(
            ghostX,
            Math.min(y + PHONEME_TIMING_LAYOUT.ghostDashPx, bandBottom),
          );
      }
      bandGraphic.stroke({ width: 1, ...toFillStyle(colors.ghost) });
    }
  }

  // ラベルの位置
  // 子音の直後の母音は、子音名と重ならないよう子音名の幅だけ右にずらす
  // ノートの帯が短くずらすと収まらないときは、その母音のラベルを出さない
  const visiblePhonemes = bands
    .flatMap((band) => {
      const startX = toScreenX(band.startTimeSeconds);
      const endX = toScreenX(band.endTimeSeconds);
      return band.boundaries.map((info, index) => {
        const x = toScreenX(info.displayStartTimeSeconds);
        const previous = band.boundaries[index - 1];
        const vowelAfterConsonant =
          previous != undefined &&
          previous.phoneme !== "pau" &&
          !isVowel(previous.phoneme) &&
          isVowel(info.phoneme);
        const labelX = vowelAfterConsonant
          ? Math.max(
              x,
              // kyなど複数文字の子音名が、後続の母音で欠けない幅を確保する
              toScreenX(previous.displayStartTimeSeconds) +
                getLabelWidth(previous.phoneme) +
                PHONEME_TIMING_LAYOUT.labelSpacingPx,
            )
          : x;
        return {
          info,
          x,
          labelX,
          showLabel:
            !vowelAfterConsonant ||
            endX - startX >= PHONEME_TIMING_LAYOUT.vowelLabelMinSpanPx,
        };
      });
    })
    // 画面端から入ってくるラベルの分だけ余裕を持たせておく
    .filter(({ x }) => x >= -80 && x <= viewportWidth + 80);

  while (graphics.length < visiblePhonemes.length) {
    const graphic = new PIXI.Graphics();
    stage.addChild(graphic);
    graphics.push(graphic);
  }

  const visibleLabels: typeof labels.value = [];
  let visibleChip: typeof chip.value;

  // 音素境界
  // 境界線と操作用のハンドルを置き、操作中はラベルの代わりにツールチップを出す
  for (const [i, { info, x, labelX, showLabel }] of visiblePhonemes.entries()) {
    const isTarget =
      target?.noteId === info.noteId &&
      target.phonemeIndexInNote === info.phonemeIndexInNote;
    const inTargetNote = target?.noteId === info.noteId;
    const moving = info.displayState === "movePreview";
    const edited = info.displayState === "edited";
    // 境界線の色は、ドラッグ中・編集済み・操作対象のノート内・ノートの先頭・それ以外の順に決める
    // ノートの先頭の境界はノートの切れ目を見分けやすくするため、後続の境界より濃くする
    const color = moving
      ? colors.editing
      : edited
        ? colors.edited
        : inTargetNote
          ? colors.hover
          : info.phonemeIndexInNote === 0
            ? colors.head
            : colors.follow;
    const lineWidth = moving || edited ? 2 : 1;
    const lineX = Math.round(x) - 0.5;
    const graphic = graphics[i];
    graphic.renderable = true;
    graphic.clear();

    graphic
      .moveTo(lineX, bandTop)
      .lineTo(lineX, bandBottom)
      .stroke({ width: lineWidth, ...toFillStyle(color) });
    // ドラッグ中は上端まで線を伸ばし、ノートやグリッドとの位置関係を見比べられるようにする
    if (moving) {
      graphic
        .moveTo(lineX, 0)
        .lineTo(lineX, bandTop)
        .stroke({ width: 1, ...toFillStyle(colors.guide) });
    }

    // 操作対象のノートの境界にハンドルを付けてつかめる位置を示す
    if (inTargetNote) {
      const width = isTarget
        ? PHONEME_TIMING_LAYOUT.activeHandleWidthPx
        : PHONEME_TIMING_LAYOUT.handleWidthPx;
      const height = isTarget
        ? PHONEME_TIMING_LAYOUT.activeHandleHeightPx
        : PHONEME_TIMING_LAYOUT.handleHeightPx;
      graphic
        .roundRect(
          lineX - width / 2,
          bandTop,
          width,
          height,
          PHONEME_TIMING_LAYOUT.handleRadiusPx,
        )
        .fill(toFillStyle(color));
    }

    const deltaMs = Math.round(
      (info.displayStartTimeSeconds - info.originalStartTimeSeconds) * 1000,
    );
    // ラベルは次のラベルの手前までとし、隣と重ならないようにする
    if (info.phoneme !== "pau" && showLabel && !isTarget) {
      visibleLabels.push({
        key: `${info.noteId}:${info.phonemeIndexInNote}`,
        x: labelX,
        y: labelTop,
        text: info.phoneme,
        active: inTargetNote,
        maxWidth: Math.max(
          PHONEME_TIMING_LAYOUT.labelMinWidthPx,
          (visiblePhonemes[i + 1]?.labelX ?? viewportWidth) - labelX,
        ),
      });
    }
    // チップ内の音素名を、ラベルと同じ位置に重ね、ラベルからチップに切り替わっても文字が動いて把握しづらくなるのを避ける
    if (isTarget) {
      visibleChip = {
        x: labelX - PHONEME_TIMING_LAYOUT.chipPaddingPx,
        y:
          labelTop -
          (PHONEME_TIMING_LAYOUT.chipHeightPx -
            PHONEME_TIMING_LAYOUT.labelHeightPx) /
            2,
        phoneme: info.phoneme,
        deltaMs,
      };
    }
  }
  labels.value = visibleLabels;
  chip.value = visibleChip;

  for (let i = visiblePhonemes.length; i < graphics.length; i++)
    graphics[i].renderable = false;
  renderer.render(stage);
};

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch(
  [
    mounted,
    phonemeTimingInfos,
    previewPhonemeTiming,
    tempos,
    tpqn,
    editorFrameRate,
    isDark,
    () => props.activePhoneme,
    () => store.getters.SELECTED_TRACK.notes,
    () => props.viewportInfo.scaleX,
    () => props.viewportInfo.offsetX,
  ],
  ([mounted]) => {
    if (mounted) {
      renderInNextFrame = true;
    }
  },
);

onMounted(async () => {
  const canvasContainerElement = canvasContainer.value;
  const canvasElement = canvas.value;
  assertNonNullable(canvasContainerElement);
  assertNonNullable(canvasElement);

  await document.fonts.load(PHONEME_LABEL_FONT);
  if (isUnmounted) return;
  const context = document.createElement("canvas").getContext("2d");
  assertNonNullable(context);
  context.font = PHONEME_LABEL_FONT;
  labelTextContext = context;

  canvasWidth = canvasContainerElement.clientWidth;
  canvasHeight = canvasContainerElement.clientHeight;

  renderer = await PIXI.autoDetectRenderer({
    canvas: canvasElement,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    width: canvasWidth,
    height: canvasHeight,
  });
  if (isUnmounted) {
    renderer.destroy({ removeView: true });
    return;
  }
  stage = new PIXI.Container();
  bandGraphic = new PIXI.Graphics();
  stage.addChild(bandGraphic);

  const callback = () => {
    if (renderInNextFrame) {
      render();
      renderInNextFrame = false;
    }
    requestId = window.requestAnimationFrame(callback);
  };
  requestId = window.requestAnimationFrame(callback);

  resizeObserver = new ResizeObserver(() => {
    assertNonNullable(renderer);

    const newWidth = canvasContainerElement.clientWidth;
    const newHeight = canvasContainerElement.clientHeight;

    if (newWidth > 0 && newHeight > 0) {
      canvasWidth = newWidth;
      canvasHeight = newHeight;
      renderer.resize(canvasWidth, canvasHeight);
      // 次フレームに描画を持ち越すとリサイズ直後の空canvasが一瞬表示されて点滅するため、
      // ペイント前のResizeObserverコールバック内で同期的に描画する
      renderInNextFrame = false;
      render();
    }
  });
  resizeObserver.observe(canvasContainerElement);
});

onUnmounted(() => {
  isUnmounted = true;

  if (requestId != undefined) {
    window.cancelAnimationFrame(requestId);
  }

  for (const graphic of graphics) {
    stage?.removeChild(graphic);
    graphic.destroy();
  }
  stage?.destroy(true);
  renderer?.destroy({ removeView: true });
  resizeObserver?.disconnect();
});
</script>

<style scoped lang="scss">
.canvas-container {
  overflow: hidden;
  pointer-events: none;
  position: relative;

  contain: strict; // canvasのサイズが変わるのを無視する
}
.phoneme-label,
.phoneme-chip-name {
  font: v-bind(PHONEME_LABEL_FONT);
  line-height: v-bind("`${PHONEME_TIMING_LAYOUT.labelHeightPx}px`");
}

.phoneme-label {
  $outline-color: var(--scheme-color-song-grid-cell-white);

  position: absolute;
  overflow: clip;
  overflow-clip-margin: 1px;
  white-space: nowrap;
  color: var(--scheme-color-song-phoneme-label);
  text-shadow:
    -1px -1px 0 $outline-color,
    1px -1px 0 $outline-color,
    -1px 1px 0 $outline-color,
    1px 1px 0 $outline-color,
    0 -1px 0 $outline-color,
    0 1px 0 $outline-color,
    -1px 0 0 $outline-color,
    1px 0 0 $outline-color;

  &.active {
    color: var(--scheme-color-song-phoneme-label-hover);
  }
}

.phoneme-chip {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  height: v-bind("`${PHONEME_TIMING_LAYOUT.chipHeightPx}px`");
  padding: 0 v-bind("`${PHONEME_TIMING_LAYOUT.chipPaddingPx}px`");
  border: 1px solid var(--scheme-color-song-parameter-tooltip-border);
  border-radius: 6px;
  box-shadow: 0 2px 4px var(--scheme-color-song-parameter-tooltip-shadow);
  background: var(--scheme-color-song-parameter-tooltip-container);
  color: var(--scheme-color-song-on-parameter-tooltip-container);
  font-size: v-bind("`${PHONEME_TIMING_LAYOUT.labelFontSizePx}px`");
  line-height: v-bind("`${PHONEME_TIMING_LAYOUT.labelHeightPx}px`");
  font-weight: 400;
  white-space: nowrap;
}

.phoneme-chip-delta {
  font-size: 10px;
  color: var(--scheme-color-song-phoneme-chip-delta);
  font-variant-numeric: tabular-nums;
}
</style>
