<template>
  <div ref="canvasContainer" class="canvas-container">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted, onMounted, toRaw } from "vue";
import * as PIXI from "pixi.js";
import { useStore } from "@/store";
import { useMounted } from "@/composables/useMounted";
import { tickToBaseX, type ViewportInfo } from "@/sing/viewHelper";
import { getDefaultLyric } from "@/sing/domain";
import { getOrThrow } from "@/helpers/mapHelper";
import { clamp } from "@/sing/utility";

const props = defineProps<{
  viewportInfo: ViewportInfo;
}>();

const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const isDark = computed(() => store.state.currentTheme === "Dark");
const defaultLyricMode = computed(() => store.state.defaultLyricMode);
const selectedTrack = computed(() => store.getters.SELECTED_TRACK);

type ColorStyle = {
  noteFill: number;
  noteBorder: number;
};

const noteColorStyles: {
  light: ColorStyle;
  dark: ColorStyle;
} = {
  light: {
    noteFill: 0xdfe3e0,
    noteBorder: 0xffffff,
  },
  dark: {
    noteFill: 0x363936,
    noteBorder: 0x262728,
  },
};

const noteColors = computed(() =>
  isDark.value ? noteColorStyles.dark : noteColorStyles.light,
);

const noteTextStyles: {
  light: PIXI.TextStyle;
  dark: PIXI.TextStyle;
} = {
  light: new PIXI.TextStyle({ fill: "#423e3f", fontSize: 14 }),
  dark: new PIXI.TextStyle({ fill: "#bfbbbc", fontSize: 14 }),
};

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
const texts: PIXI.Text[] = [];
const textContainersMap = new Map<PIXI.Text, PIXI.Container>();
const textMasksMap = new Map<PIXI.Text, PIXI.Graphics>();
let lastIsDark: boolean | undefined;
let requestId: number | undefined;
let renderInNextFrame = false;

const render = () => {
  if (renderer == undefined) {
    throw new Error("renderer is undefined.");
  }
  if (stage == undefined) {
    throw new Error("stage is undefined.");
  }
  if (canvasWidth == undefined) {
    throw new Error("canvasWidth is undefined.");
  }
  if (canvasHeight == undefined) {
    throw new Error("canvasHeight is undefined.");
  }

  const notes = selectedTrackNotes.value;
  const scaleX = store.state.sequencerZoomX;
  const offsetXValue = props.viewportInfo.offsetX;
  const colors = noteColors.value;
  const currentTextStyle = isDark.value
    ? noteTextStyles.dark
    : noteTextStyles.light;

  // テーマが変わるとテキストスタイルも変わるため、既存のテキストオブジェクトを全て破棄する
  if (lastIsDark != undefined && lastIsDark !== isDark.value) {
    for (const text of texts) {
      const container = getOrThrow(textContainersMap, text);
      stage.removeChild(container);
      container.destroy(true);
    }
    texts.length = 0;
    textContainersMap.clear();
    textMasksMap.clear();
  }
  lastIsDark = isDark.value;

  let graphicsIndex = 0;
  let textIndex = 0;

  // マスク計算で使うテキストの位置情報
  const textPositions: { textX: number; text: PIXI.Text }[] = [];

  // 各ノートを描画
  for (const note of notes) {
    const rawNote = toRaw(note);

    // 位置とサイズを計算
    const baseStartX = tickToBaseX(rawNote.position, tpqn.value);
    const baseEndX = tickToBaseX(
      rawNote.position + rawNote.duration,
      tpqn.value,
    );
    const screenStartX = Math.round(baseStartX * scaleX - offsetXValue);
    const screenEndX = Math.round(baseEndX * scaleX - offsetXValue);
    const screenWidth = screenEndX - screenStartX;

    // 画面外のノートは描画しない
    const noteRight = screenStartX + screenWidth;
    if (screenWidth < 1 || noteRight < 0 || screenStartX > canvasWidth) {
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

    // ノートの長方形を描画
    // 選択中のノートも同じ色で描画する
    graphic.renderable = true;
    graphic.clear();
    graphic
      .roundRect(screenStartX - 0.5, 0.5, screenWidth, canvasHeight - 1, 5)
      .fill({ color: colors.noteFill, alpha: 1 })
      .stroke({ width: 1, color: colors.noteBorder, alpha: 1 });

    // ノートの歌詞をテキストで描画
    const lyric =
      rawNote.lyric ??
      getDefaultLyric(rawNote.noteNumber, defaultLyricMode.value);
    if (textIndex >= texts.length) {
      const newText = new PIXI.Text({ text: "", style: currentTextStyle });
      const container = new PIXI.Container();
      const mask = new PIXI.Graphics();

      container.mask = mask;
      container.addChild(newText);
      container.addChild(mask);
      stage.addChild(container);
      texts.push(newText);
      textContainersMap.set(newText, container);
      textMasksMap.set(newText, mask);
    }
    const text = texts[textIndex];
    textIndex++;

    text.text = lyric;
    text.anchor.set(0, 0.5);

    const textContainer = getOrThrow(textContainersMap, text);
    textContainer.renderable = true;
    textContainer.x = screenStartX + 3;
    textContainer.y = canvasHeight / 2;

    textPositions.push({ textX: textContainer.x, text });
  }

  // 各テキストが次のテキストと重ならないようにマスクをかける
  for (let i = 0; i < textPositions.length; i++) {
    const { textX, text } = textPositions[i];
    const textMask = getOrThrow(textMasksMap, text);

    // デフォルトのマスク幅
    let maskWidth = 36;

    // 次のテキストがある場合、その位置までに制限
    if (i + 1 < textPositions.length) {
      const nextTextX = textPositions[i + 1].textX;
      maskWidth = clamp(nextTextX - textX, 0, maskWidth);
    }

    const maskHeight = 36;

    textMask
      .clear()
      .rect(0, -maskHeight / 2, maskWidth, maskHeight)
      .fill({ color: 0xffffff });
  }

  // 未使用のグラフィックスとテキストを非表示
  for (let i = graphicsIndex; i < graphics.length; i++) {
    graphics[i].renderable = false;
  }
  for (let i = textIndex; i < texts.length; i++) {
    const text = texts[i];
    const textContainer = getOrThrow(textContainersMap, text);
    textContainer.renderable = false;
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
    () => store.state.sequencerZoomX,
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
  if (canvasContainerElement == undefined) {
    throw new Error("canvasContainerElement is null.");
  }
  if (canvasElement == undefined) {
    throw new Error("canvasElement is null.");
  }

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
    if (renderer == undefined) {
      throw new Error("renderer is undefined.");
    }
    const canvasContainerWidth = canvasContainerElement.clientWidth;
    const canvasContainerHeight = canvasContainerElement.clientHeight;

    if (canvasContainerWidth > 0 && canvasContainerHeight > 0) {
      canvasWidth = canvasContainerWidth;
      canvasHeight = canvasContainerHeight;
      renderer.resize(canvasWidth, canvasHeight);
      renderInNextFrame = true;
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
  for (const text of texts) {
    const container = getOrThrow(textContainersMap, text);
    stage?.removeChild(container);
    container.destroy(true);
  }
  textContainersMap.clear();
  textMasksMap.clear();
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
</style>
