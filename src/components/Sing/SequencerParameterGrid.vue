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
import {
  tickToBaseX,
  type ViewportInfo,
  type CanvasSize,
} from "@/sing/viewHelper";
import { numMeasuresInjectionKey } from "@/components/Sing/ScoreSequencer.vue";
import type { TimeSignature } from "@/domain/project/type";
import { getBeatDuration, getMeasureDuration } from "@/sing/music";

type GridLineInfo = {
  x: number;
  type: "measure" | "beat";
};

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
const graphics: PIXI.Graphics[] = [];
let requestId: number | undefined;
let renderInNextFrame = false;

const getMeasureWidth = (timeSignature: TimeSignature) => {
  const measureTicks = getMeasureDuration(
    timeSignature.beats,
    timeSignature.beatType,
    tpqn.value,
  );
  return tickToBaseX(measureTicks, tpqn.value) * props.viewportInfo.scaleX;
};

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

  const canvasSize: CanvasSize = {
    width: canvasWidth,
    height: canvasHeight,
  };

  // 可視範囲内の小節線・拍線の位置を計算
  const visibleLines: GridLineInfo[] = [];
  const viewportLeft = props.viewportInfo.offsetX - 1;
  const viewportRight = props.viewportInfo.offsetX + canvasSize.width + 1;

  let sectionStartX = 0;
  for (const [i, timeSignature] of timeSignatures.value.entries()) {
    const nextTimeSignature = timeSignatures.value.at(i + 1);
    const nextMeasureNumber =
      nextTimeSignature?.measureNumber ?? numMeasures.value + 1;
    const measureCount = nextMeasureNumber - timeSignature.measureNumber;
    const measureWidth = getMeasureWidth(timeSignature);
    const beatTicks = getBeatDuration(timeSignature.beatType, tpqn.value);
    const beatWidth =
      tickToBaseX(beatTicks, tpqn.value) * props.viewportInfo.scaleX;
    const sectionWidth = measureWidth * measureCount;

    // セクションが可視範囲と重ならなければスキップ
    if (
      sectionStartX + sectionWidth < viewportLeft ||
      sectionStartX > viewportRight
    ) {
      sectionStartX += sectionWidth;
      continue;
    }

    // セクション内で可視範囲に入る最初と最後の小節インデックス（0始まり）を計算
    const firstMeasureIndex = Math.max(
      0,
      Math.floor((viewportLeft - sectionStartX) / measureWidth),
    );
    const lastMeasureIndexExclusive = Math.min(
      measureCount,
      Math.ceil((viewportRight - sectionStartX) / measureWidth),
    );

    for (let k = firstMeasureIndex; k < lastMeasureIndexExclusive; k++) {
      const measureX = sectionStartX + k * measureWidth;
      // 拍線
      for (let beat = 1; beat < timeSignature.beats; beat++) {
        visibleLines.push({
          x: measureX + beatWidth * beat,
          type: "beat",
        });
      }
      // 小節線（小節の右端 = 次の小節の左端）。先頭の0位置は出力しない
      visibleLines.push({ x: measureX + measureWidth, type: "measure" });
    }

    sectionStartX += sectionWidth;
  }

  // Graphicsは単一インスタンスに集約して描画する
  if (graphics.length === 0) {
    const newGraphic = new PIXI.Graphics();
    stage.addChild(newGraphic);
    graphics.push(newGraphic);
  } else if (graphics.length > 1) {
    for (let i = graphics.length - 1; i >= 1; i--) {
      stage.removeChild(graphics[i]);
      graphics[i].destroy();
      graphics.splice(i, 1);
    }
  }

  const graphic = graphics[0];
  graphic.clear();

  // 線をまとめて描画
  for (const line of visibleLines) {
    const lineX = Math.round(line.x - props.viewportInfo.offsetX);
    const currentLineStyle = gridLineStyles[currentTheme.value][line.type];
    graphic.lineStyle(1, currentLineStyle.color, currentLineStyle.alpha);
    graphic.moveTo(lineX - 0.5, 0);
    graphic.lineTo(lineX - 0.5, canvasSize.height);
  }

  renderer.render(stage);
};

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch([mounted, timeSignatures, numMeasures, currentTheme], ([mounted]) => {
  if (mounted) {
    renderInNextFrame = true;
  }
});

watch(
  () => [props.viewportInfo.scaleX, props.viewportInfo.offsetX],
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
  stage?.destroy();
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
