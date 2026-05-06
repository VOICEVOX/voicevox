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
import { tickToBaseX, type ViewportInfo } from "@/sing/viewHelper";
import { numMeasuresInjectionKey } from "@/components/Sing/ScoreSequencer.vue";
import {
  getBeatDuration,
  getMeasureDuration,
  getTimeSignaturePositions,
} from "@/sing/music";
import { assertNonNullable } from "@/type/utility";

const props = defineProps<{
  viewportInfo: ViewportInfo;
}>();

const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const currentTheme = computed(() =>
  store.state.currentTheme === "Dark" ? "dark" : "light",
);

const injectedValue = inject(numMeasuresInjectionKey);
if (injectedValue == undefined) {
  throw new Error("injectedValue is undefined.");
}
const { numMeasures } = injectedValue;

type LineStyle = {
  color: number;
  alpha: number;
};

type GridLineStyle = {
  measure: LineStyle;
  beat: LineStyle;
};

// テーマに応じた線のスタイル
const gridLineStyles: Record<"light" | "dark", GridLineStyle> = {
  light: {
    measure: {
      color: 0x8a8a8a,
      alpha: 0.35,
    },
    beat: {
      color: 0xc4c4c4,
      alpha: 0.25,
    },
  },
  dark: {
    measure: {
      color: 0x6b6b6b,
      alpha: 0.35,
    },
    beat: {
      color: 0x4a4a4a,
      alpha: 0.25,
    },
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
let graphic: PIXI.Graphics | undefined;
let requestId: number | undefined;
let renderInNextFrame = false;
let isUnmounted = false;

const render = () => {
  assertNonNullable(renderer);
  assertNonNullable(stage);
  assertNonNullable(canvasWidth);
  assertNonNullable(canvasHeight);

  // 可視範囲内の小節線・拍線のX座標を収集する
  // ±1pxは、丸め誤差で境界線が切れるのを防ぐためのマージン
  const viewportLeft = props.viewportInfo.offsetX - 1;
  const viewportRight = props.viewportInfo.offsetX + canvasWidth + 1;
  const viewportScaleX = props.viewportInfo.scaleX;
  const measureLineXs: number[] = [];
  const beatLineXs: number[] = [];

  // 各拍子のtick位置を事前計算
  const tsPositions = getTimeSignaturePositions(
    timeSignatures.value,
    tpqn.value,
  );

  // 各拍子区間から可視範囲内の線座標を収集
  for (const [i, tsSection] of timeSignatures.value.entries()) {
    const nextTsSection = timeSignatures.value.at(i + 1);
    const nextMeasureNumber =
      nextTsSection?.measureNumber ?? numMeasures.value + 1;
    const measureCount = nextMeasureNumber - tsSection.measureNumber;
    const measureTicks = getMeasureDuration(
      tsSection.beats,
      tsSection.beatType,
      tpqn.value,
    );
    const measureWidth = tickToBaseX(measureTicks, tpqn.value) * viewportScaleX;
    const beatTicks = getBeatDuration(tsSection.beatType, tpqn.value);
    const beatWidth = tickToBaseX(beatTicks, tpqn.value) * viewportScaleX;
    const tsSectionStartX =
      tickToBaseX(tsPositions[i], tpqn.value) * viewportScaleX;
    const tsSectionEndX = tsSectionStartX + measureWidth * measureCount;

    // ビューポートと拍子区間の交差
    const visibleStartX = Math.max(viewportLeft, tsSectionStartX);
    const visibleEndX = Math.min(viewportRight, tsSectionEndX);

    // 交差が空ならこの拍子区間は見えないのでスキップ
    if (visibleStartX >= visibleEndX) {
      continue;
    }

    // 交差に含まれる小節インデックスの範囲（0始まり）
    const startMeasureIndex = Math.floor(
      (visibleStartX - tsSectionStartX) / measureWidth,
    );
    const endMeasureIndex = Math.ceil(
      (visibleEndX - tsSectionStartX) / measureWidth,
    );

    for (let k = startMeasureIndex; k < endMeasureIndex; k++) {
      const measureX = tsSectionStartX + k * measureWidth;
      // 拍線
      for (let beat = 1; beat < tsSection.beats; beat++) {
        beatLineXs.push(measureX + beatWidth * beat);
      }
      // 小節線（小節の右端 = 次の小節の左端）。先頭の0位置は出力しない
      measureLineXs.push(measureX + measureWidth);
    }
  }

  if (graphic == undefined) {
    graphic = new PIXI.Graphics();
    stage.addChild(graphic);
  }
  graphic.clear();

  const style = gridLineStyles[currentTheme.value];

  // 小節線をまとめて描画
  graphic.lineStyle(1, style.measure.color, style.measure.alpha);
  for (const x of measureLineXs) {
    const lineX = Math.round(x - props.viewportInfo.offsetX);
    graphic.moveTo(lineX - 0.5, 0);
    graphic.lineTo(lineX - 0.5, canvasHeight);
  }

  // 拍線をまとめて描画
  graphic.lineStyle(1, style.beat.color, style.beat.alpha);
  for (const x of beatLineXs) {
    const lineX = Math.round(x - props.viewportInfo.offsetX);
    graphic.moveTo(lineX - 0.5, 0);
    graphic.lineTo(lineX - 0.5, canvasHeight);
  }

  renderer.render(stage);
};

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch(
  [mounted, tpqn, timeSignatures, numMeasures, currentTheme],
  ([mounted]) => {
    if (mounted) {
      renderInNextFrame = true;
    }
  },
);

watch(
  () => [props.viewportInfo.scaleX, props.viewportInfo.offsetX],
  () => {
    renderInNextFrame = true;
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
  if (graphic != undefined) {
    stage?.removeChild(graphic);
    graphic.destroy();
  }
  stage?.destroy();
  renderer?.destroy({ removeView: true });
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
