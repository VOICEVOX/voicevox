<template>
  <div ref="canvasContainer" class="canvas-container">
    <canvas ref="canvas"></canvas>
    <div
      v-for="lyric in lyrics"
      :key="lyric.id"
      class="note-lyric"
      :class="{ active: lyric.id === activeNoteId }"
      :style="{
        left: `${lyric.x}px`,
        top: `${lyric.y}px`,
        maxWidth: `${lyric.width}px`,
      }"
    >
      {{ lyric.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted, onMounted, toRaw } from "vue";
import * as PIXI from "pixi.js";
import { useStore } from "@/store";
import { useTheme } from "@/plugins/themePlugin";
import { useMounted } from "@/composables/useMounted";
import { tickToBaseX, type ViewportInfo } from "@/song/viewHelper";
import { getDefaultLyric } from "@/song/domain";
import { assertNonNullable } from "@/type/utility";
import type { NoteId } from "@/type/preload";
import { createThemeColorResolver } from "@/song/graphics/cssColor";
import {
  PHONEME_TIMING_LAYOUT,
  type PhonemeTimingLayout,
} from "@/components/Song/SequencerPhonemeTimingEditor/style";

const props = defineProps<{
  viewportInfo: ViewportInfo;
  layout: PhonemeTimingLayout;
  activeNoteId?: NoteId;
}>();

const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const { isDark } = useTheme();
const defaultLyricMode = computed(() => store.state.defaultLyricMode);
const selectedTrack = computed(() => store.getters.SELECTED_TRACK);

const resolveNoteTickColors = createThemeColorResolver({
  normal: "--scheme-color-song-parameter-note-tick",
  active: "--scheme-color-song-parameter-note-tick-active",
});
const lyrics = ref<
  { id: NoteId; x: number; y: number; width: number; text: string }[]
>([]);

const selectedTrackNotes = computed(() => selectedTrack.value.notes);

const { mounted } = useMounted();

const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;

// TODO: pixi.js関連の変数をまとめてモジュール化し、isUnmountedなどのフラグを無くす
let isUnmounted = false;
let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;
const graphics: PIXI.Graphics[] = [];
let requestId: number | undefined;
let renderInNextFrame = false;

const render = () => {
  assertNonNullable(renderer);
  assertNonNullable(stage);
  assertNonNullable(canvasWidth);
  assertNonNullable(canvasHeight);
  assertNonNullable(canvasContainer.value);

  const notes = selectedTrackNotes.value;
  const scaleX = props.viewportInfo.scaleX;
  const offsetXValue = props.viewportInfo.offsetX;
  const tickColors = resolveNoteTickColors(canvasContainer.value, isDark.value);
  const { noteTop, noteHeight } = props.layout;

  let graphicsIndex = 0;
  const visibleLyrics: typeof lyrics.value = [];

  // 各ノートを描画
  for (const note of notes) {
    const rawNote = toRaw(note);

    // 位置とサイズを計算
    const baseStartX = tickToBaseX(rawNote.position, tpqn.value);
    const baseEndX = tickToBaseX(
      rawNote.position + rawNote.duration,
      tpqn.value,
    );
    const screenStartX = baseStartX * scaleX - offsetXValue;
    const screenEndX = baseEndX * scaleX - offsetXValue;
    const screenWidth = Math.max(2, screenEndX - screenStartX - 1);

    // 画面外のノートは描画しない
    const noteRight = screenStartX + screenWidth;
    if (noteRight < 0 || screenStartX > canvasWidth) {
      continue;
    }

    // Graphicsは使い回し、足りない分だけ作成する
    if (graphicsIndex >= graphics.length) {
      const newGraphic = new PIXI.Graphics();
      stage.addChild(newGraphic);
      graphics.push(newGraphic);
    }
    const graphic = graphics[graphicsIndex];
    graphicsIndex++;

    const tickColor =
      props.activeNoteId === note.id ? tickColors.active : tickColors.normal;
    graphic.renderable = true;
    graphic.clear();
    // ノートの目盛りと-1px左にあるグリッド線位置を揃えるため、目盛りを-1pxして調整
    graphic
      .rect(
        Math.round(screenStartX) - 1,
        noteTop + noteHeight - PHONEME_TIMING_LAYOUT.noteTickHeightPx,
        1,
        PHONEME_TIMING_LAYOUT.noteTickHeightPx,
      )
      .fill({
        color: tickColor.toRgbNumber(),
        alpha: tickColor.toAlphaFloat(),
      });

    // 短いノートの場合は目盛りは表示するが、歌詞は無理に表示しない
    if (screenWidth < PHONEME_TIMING_LAYOUT.lyricMinWidthPx) continue;

    visibleLyrics.push({
      id: note.id,
      x: screenStartX,
      y:
        noteTop +
        noteHeight -
        PHONEME_TIMING_LAYOUT.noteTickHeightPx -
        PHONEME_TIMING_LAYOUT.labelHeightPx,
      width: screenWidth,
      text:
        rawNote.lyric ??
        getDefaultLyric(rawNote.noteNumber, defaultLyricMode.value),
    });
  }
  lyrics.value = visibleLyrics;

  // 未使用のグラフィックスとテキストを非表示
  for (let i = graphicsIndex; i < graphics.length; i++) {
    graphics[i].renderable = false;
  }
  renderer.render(stage);
};

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch(
  [
    mounted,
    selectedTrackNotes,
    tpqn,
    defaultLyricMode,
    isDark,
    () => props.activeNoteId,
    () => props.layout,
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
    const canvasContainerWidth = canvasContainerElement.clientWidth;
    const canvasContainerHeight = canvasContainerElement.clientHeight;

    if (canvasContainerWidth > 0 && canvasContainerHeight > 0) {
      canvasWidth = canvasContainerWidth;
      canvasHeight = canvasContainerHeight;
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
  font-family: "Unhinted Rounded M+ 1p Medium", sans-serif;
  overflow: hidden;
  pointer-events: none;
  position: relative;

  contain: strict; // canvasのサイズが変わるのを無視する
}
.note-lyric {
  position: absolute;
  overflow: hidden;
  white-space: nowrap;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  color: var(--scheme-color-song-parameter-note-tick);

  &.active {
    color: var(--scheme-color-song-parameter-note-tick-active);
  }
}
</style>
