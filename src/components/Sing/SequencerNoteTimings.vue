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
import { getDoremiFromNoteNumber, tickToBaseX } from "@/sing/viewHelper";
import { getOrThrow } from "@/helpers/mapHelper";

const props = defineProps<{
  offsetX: number;
  offsetY: number;
}>();

const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const isDark = computed(() => store.state.currentTheme === "Dark");
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

const selectedTrackNotes = computed(() => {
  return selectedTrack.value?.notes ?? [];
});

const { mounted } = useMounted();

const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;

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
  const scaleX = toRaw(store.state.sequencerZoomX);
  const offsetXValue = toRaw(props.offsetX);
  const colors = noteColors.value;
  const currentTextStyle = isDark.value
    ? noteTextStyles.dark
    : noteTextStyles.light;

  // テーマが変更された場合、全てのテキスト関連オブジェクトをクリア
  if (lastIsDark != undefined && lastIsDark !== isDark.value) {
    for (const text of texts) {
      const container = textContainersMap.get(text);
      if (container != undefined) {
        stage.removeChild(container);
        container.destroy(true);
      }
    }
    texts.length = 0;
    textContainersMap.clear();
    textMasksMap.clear();
  }
  lastIsDark = isDark.value;

  let graphicsIndex = 0;
  let textIndex = 0;

  // ノートの位置情報を格納（マスク計算用）
  const notePositions: { screenStartX: number; text: PIXI.Text }[] = [];

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

    // 可視性をチェック（ビューポートカリング）
    const noteRight = screenStartX + screenWidth;
    if (screenWidth < 1 || noteRight < 0 || screenStartX > canvasWidth) {
      continue;
    }

    // グラフィックスを取得または作成
    if (graphicsIndex >= graphics.length) {
      const newGraphic = new PIXI.Graphics();
      stage.addChild(newGraphic);
      graphics.push(newGraphic);
    }
    const graphic = graphics[graphicsIndex];
    graphicsIndex++;

    // 長方形を描画（選択状態に関わらず同じ色）
    graphic.renderable = true;
    graphic.clear();
    graphic.lineStyle(1, colors.noteBorder, 1);
    graphic.beginFill(colors.noteFill, 1);
    graphic.drawRoundedRect(
      screenStartX - 0.5,
      0.5,
      screenWidth,
      canvasHeight - 1,
      5,
    );
    graphic.endFill();

    // ノートの歌詞をテキストで描画
    const lyric = rawNote.lyric ?? getDoremiFromNoteNumber(rawNote.noteNumber);
    if (textIndex >= texts.length) {
      const newText = new PIXI.Text("", currentTextStyle);
      const container = new PIXI.Container();
      const mask = new PIXI.Graphics();

      container.mask = mask;
      container.addChild(newText);
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

    // 位置情報を記録（マスク計算用）
    notePositions.push({ screenStartX: textContainer.x, text });
  }

  // マスク処理：各テキストが次のテキストと被らないようにする
  for (let i = 0; i < notePositions.length; i++) {
    const { screenStartX, text } = notePositions[i];
    const textMask = textMasksMap.get(text);
    const textContainer = textContainersMap.get(text);

    if (textMask == undefined || textContainer == undefined) {
      continue;
    }

    // デフォルトのマスク幅
    let maskWidth = 36;

    // 次のテキストがある場合、その位置までに制限
    if (i + 1 < notePositions.length) {
      const nextScreenStartX = notePositions[i + 1].screenStartX;
      maskWidth = Math.min(maskWidth, nextScreenStartX - screenStartX);
    }

    const maskHeight = 36;

    textMask
      .clear()
      .beginFill(0xffffff)
      .drawRect(
        textContainer.x,
        textContainer.y - maskHeight / 2,
        maskWidth,
        maskHeight,
      )
      .endFill();
  }

  // 未使用のグラフィックスとテキストを非表示
  for (let i = graphicsIndex; i < graphics.length; i++) {
    graphics[i].renderable = false;
  }
  for (let i = textIndex; i < texts.length; i++) {
    const text = texts[i];
    const textContainer = textContainersMap.get(text);
    if (textContainer != undefined) {
      textContainer.renderable = false;
    }
  }

  renderer.render(stage);
};

// mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch([mounted, selectedTrackNotes, tpqn], ([mounted]) => {
  if (mounted) {
    renderInNextFrame = true;
  }
});

watch(isDark, () => {
  renderInNextFrame = true;
});

watch(
  () => [store.state.sequencerZoomX, props.offsetX],
  () => {
    renderInNextFrame = true;
  },
);

onMounted(() => {
  const canvasContainerElement = canvasContainer.value;
  const canvasElement = canvas.value;
  if (!canvasContainerElement) {
    throw new Error("canvasContainerElement is null.");
  }
  if (!canvasElement) {
    throw new Error("canvasElement is null.");
  }

  canvasWidth = canvasContainerElement.clientWidth;
  canvasHeight = canvasContainerElement.clientHeight;

  // PIXI Rendererの初期化
  renderer = new PIXI.Renderer({
    view: canvasElement,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    width: canvasWidth,
    height: canvasHeight,
  });
  stage = new PIXI.Container();

  // アニメーションループ（requestAnimationFrame）
  const callback = () => {
    if (renderInNextFrame) {
      render();
      renderInNextFrame = false;
    }
    requestId = window.requestAnimationFrame(callback);
  };
  requestId = window.requestAnimationFrame(callback);

  // リサイズ監視
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
  // アニメーションループの停止
  if (requestId != undefined) {
    window.cancelAnimationFrame(requestId);
  }

  // PIXIオブジェクトのクリーンアップ
  for (const graphic of graphics) {
    stage?.removeChild(graphic);
    graphic.destroy();
  }
  for (const text of texts) {
    const container = textContainersMap.get(text);
    if (container != undefined) {
      stage?.removeChild(container);
      container.destroy(true);
    }
  }
  textContainersMap.clear();
  textMasksMap.clear();
  stage?.destroy(true);
  renderer?.destroy(true);
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
