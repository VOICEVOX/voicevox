<template>
  <div ref="canvasContainer" class="canvas-container">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted, onMounted, inject } from "vue";
import * as PIXI from "pixi.js";
import { useStore } from "@/store";
import { useMounted } from "@/composables/useMounted";
import { tickToBaseX } from "@/sing/viewHelper";
import { numMeasuresInjectionKey } from "@/components/Sing/ScoreSequencer.vue";
import type { TimeSignature } from "@/domain/project/type";
import { getLast } from "@/sing/utility";

type ViewportInfo = {
  readonly scaleX: number;
  readonly offsetX: number;
  readonly width: number;
  readonly height: number;
};

type GridLineInfo = {
  x: number;
  type: "measure" | "beat";
};

const props = defineProps<{
  offsetX: number;
}>();

const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const isDark = computed(() => store.state.currentTheme === "Dark");

const injectedValue = inject(numMeasuresInjectionKey);
if (injectedValue == undefined) {
  throw new Error("injectedValue is undefined.");
}
const { numMeasures } = injectedValue;

// テーマに応じた線のスタイル
const gridLineStyles: {
  light: { measureLineColor: number; beatLineColor: number };
  dark: { measureLineColor: number; beatLineColor: number };
} = {
  light: {
    measureLineColor: 0xeaeaea,
    beatLineColor: 0xeaeaea,
  },
  dark: {
    measureLineColor: 0x606060,
    beatLineColor: 0x404040,
  },
};

const { mounted } = useMounted();

const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;

let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;
const graphics: PIXI.Graphics[] = [];
let requestId: number | undefined;
let renderInNextFrame = false;

// 拍の幅を計算
const beatWidth = (timeSignature: TimeSignature) => {
  const beatType = timeSignature.beatType;
  const wholeNoteDuration = tpqn.value * 4;
  const beatTicks = wholeNoteDuration / beatType;
  return tickToBaseX(beatTicks, tpqn.value) * sequencerZoomX.value;
};

// 小節の幅を計算
const measureWidth = (timeSignature: TimeSignature) =>
  beatWidth(timeSignature) * timeSignature.beats;

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

  const viewportInfo: ViewportInfo = {
    scaleX: sequencerZoomX.value,
    offsetX: props.offsetX,
    width: canvasWidth,
    height: canvasHeight,
  };

  // 線の色とスタイルを取得
  const currentGridLineStyle = isDark.value
    ? gridLineStyles.dark
    : gridLineStyles.light;
  const measureLineColor = currentGridLineStyle.measureLineColor;
  const beatLineColor = currentGridLineStyle.beatLineColor;

  // 小節線と拍線の位置を計算
  const gridLines: GridLineInfo[] = [];

  // 小節線の位置を計算（SequencerGridと同じロジック）
  const measureLineXArray = [0];
  for (const [i, timeSignature] of timeSignatures.value.entries()) {
    const nextTimeSignature = timeSignatures.value.at(i + 1);
    const nextMeasureNumber =
      nextTimeSignature?.measureNumber ?? numMeasures.value + 1;
    const width = measureWidth(timeSignature);

    const left = getLast(measureLineXArray);
    for (
      let measureNumber = timeSignature.measureNumber;
      measureNumber < nextMeasureNumber;
      measureNumber++
    ) {
      measureLineXArray.push(
        left + width * (measureNumber - timeSignature.measureNumber + 1),
      );
    }
  }

  // 小節線をgridLinesに追加（0位置は除外）
  for (const x of measureLineXArray) {
    if (x !== 0) {
      gridLines.push({ x, type: "measure" });
    }
  }

  // 拍線を計算して追加
  for (const [i, timeSignature] of timeSignatures.value.entries()) {
    const nextTimeSignature = timeSignatures.value.at(i + 1);
    const nextMeasureNumber =
      nextTimeSignature?.measureNumber ?? numMeasures.value + 1;
    const width = measureWidth(timeSignature);
    const beatW = beatWidth(timeSignature);

    const left =
      i === 0 ? 0 : measureLineXArray[timeSignature.measureNumber - 1];

    for (
      let measureNumber = timeSignature.measureNumber;
      measureNumber < nextMeasureNumber;
      measureNumber++
    ) {
      const measureStartX =
        left + width * (measureNumber - timeSignature.measureNumber);

      // 拍線を追加
      for (let beat = 1; beat < timeSignature.beats; beat++) {
        const beatX = measureStartX + beatW * beat;
        gridLines.push({ x: beatX, type: "beat" });
      }
    }
  }

  // カリング: 画面外の線は除外
  const visibleLines = gridLines.filter((line) => {
    const lineScreenX = line.x - viewportInfo.offsetX;
    return lineScreenX >= -1 && lineScreenX <= viewportInfo.width + 1;
  });

  // Graphicsオブジェクトの数を調整
  const neededGraphicsCount = visibleLines.length;
  const currentGraphicsCount = graphics.length;

  if (currentGraphicsCount < neededGraphicsCount) {
    for (let i = 0; i < neededGraphicsCount - currentGraphicsCount; i++) {
      const newGraphic = new PIXI.Graphics();
      stage.addChild(newGraphic);
      graphics.push(newGraphic);
    }
  }

  // 線を描画
  for (let i = 0; i < visibleLines.length; i++) {
    const line = visibleLines[i];
    const graphic = graphics[i];

    const lineX = Math.round(line.x - viewportInfo.offsetX);
    const color = line.type === "measure" ? measureLineColor : beatLineColor;

    graphic.renderable = true;
    graphic.clear();
    graphic.lineStyle(1, color, 1);
    graphic.moveTo(lineX - 0.5, 0);
    graphic.lineTo(lineX - 0.5, viewportInfo.height);
  }

  // 残りのGraphicsを非表示にする
  for (let i = visibleLines.length; i < graphics.length; i++) {
    graphics[i].renderable = false;
  }

  renderer.render(stage);
};

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch(
  [mounted, timeSignatures, sequencerZoomX, numMeasures, isDark],
  ([mounted]) => {
    if (mounted) {
      renderInNextFrame = true;
    }
  },
);

watch(
  () => [sequencerZoomX.value, props.offsetX],
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
  if (requestId != undefined) {
    window.cancelAnimationFrame(requestId);
  }
  for (const graphic of graphics) {
    stage?.removeChild(graphic);
    graphic.destroy();
  }
  stage?.destroy(true);
  renderer?.destroy(true);
  resizeObserver?.disconnect();
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.canvas-container {
  overflow: hidden;
  pointer-events: none;
  position: relative;

  contain: strict; // canvasのサイズが変わるのを無視する
}
</style>
