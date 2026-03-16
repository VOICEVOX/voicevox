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
import { tickToBaseX } from "@/sing/viewHelper";
import { secondToTick, tickToSecond } from "@/sing/music";
import type { Tempo } from "@/domain/project/type";
import { calculateHash } from "@/sing/utility";
import { Mutex } from "@/helpers/mutex";
import { createLogger } from "@/helpers/log";

const { warn } = createLogger("SequencerWaveform");

const props = defineProps<{
  offsetX: number;
}>();

const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const tempos = computed(() => store.state.tempos);
const isDark = computed(() => store.state.currentTheme === "Dark");
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const scaleX = computed(() => store.state.sequencerZoomX);

type WaveformDataSource = {
  audioId: string;
  audioBuffer: AudioBuffer;
  audioStartTime: number;
  tempos: Tempo[];
  tpqn: number;
  viewScaleX: number;
};

type WaveformData = {
  startTicks: number;
  endTicks: number;
  minValues: Float32Array;
  maxValues: Float32Array;
};

// 選択トラックのフレーズを取得
const phrasesInSelectedTrack = computed(() => {
  return new Map(
    [...store.state.phrases.entries()].filter(
      ([, phrase]) => phrase.trackId === selectedTrackId.value,
    ),
  );
});

const waveformDataSources = computed(() => {
  const newSources: WaveformDataSource[] = [];

  for (const [phraseKey, phrase] of phrasesInSelectedTrack.value) {
    const sequenceId = store.state.phraseSequenceIds.get(phraseKey);
    if (sequenceId == undefined) {
      continue;
    }
    const audioBuffer = store.getters.GET_SEQUENCE_AUDIO_BUFFER(sequenceId);
    if (audioBuffer == undefined) {
      // AudioBufferが無い場合（NoteSequenceなど）はスキップする
      continue;
    }

    newSources.push({
      audioId: sequenceId,
      audioBuffer,
      audioStartTime: phrase.startTime,
      tempos: toRaw(tempos.value),
      tpqn: toRaw(tpqn.value),
      viewScaleX: scaleX.value,
    });
  }

  return newSources;
});

const calculateWaveformDataKey = async (
  waveformDataSource: WaveformDataSource,
) => {
  return await calculateHash({
    audioId: waveformDataSource.audioId,
    audioStartTime: waveformDataSource.audioStartTime,
    audioBufferLength: waveformDataSource.audioBuffer.length,
    audioBufferSampleRate: waveformDataSource.audioBuffer.sampleRate,
    tempos: waveformDataSource.tempos,
    tpqn: waveformDataSource.tpqn,
    viewScaleX: waveformDataSource.viewScaleX,
  });
};

const generateWaveformData = (
  waveformDataSource: WaveformDataSource,
): WaveformData => {
  const { audioBuffer, audioStartTime, tempos, tpqn, viewScaleX } =
    waveformDataSource;

  // Tick範囲を計算
  const audioBufferDurationSeconds =
    audioBuffer.length / audioBuffer.sampleRate;
  const endTime = audioStartTime + audioBufferDurationSeconds;
  const startTicks = secondToTick(audioStartTime, tempos, tpqn);
  const endTicks = secondToTick(endTime, tempos, tpqn);

  // スクリーン座標とサイズを計算
  const startBaseX = tickToBaseX(startTicks, tpqn);
  const endBaseX = tickToBaseX(endTicks, tpqn);
  const startScreenX = Math.round(startBaseX * viewScaleX);
  const endScreenX = Math.round(endBaseX * viewScaleX);
  const screenWidth = Math.floor(endScreenX - startScreenX);

  const channel = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  const minValues = new Float32Array(screenWidth);
  const maxValues = new Float32Array(screenWidth);

  const duration = endTicks - startTicks;

  for (let pixelIndex = 0; pixelIndex < screenWidth; pixelIndex++) {
    // このピクセルが表すtick範囲
    const pixelStartTicks = startTicks + (duration * pixelIndex) / screenWidth;
    const pixelEndTicks =
      startTicks + (duration * (pixelIndex + 1)) / screenWidth;

    // tick範囲を実時間範囲に変換
    const pixelStartTime = tickToSecond(pixelStartTicks, tempos, tpqn);
    const pixelEndTime = tickToSecond(pixelEndTicks, tempos, tpqn);

    // AudioBuffer内のサンプル位置を計算
    const startSample = Math.floor(
      (pixelStartTime - audioStartTime) * sampleRate,
    );
    const endSample = Math.floor((pixelEndTime - audioStartTime) * sampleRate);

    // このサンプル範囲の最小/最大値を計算
    let min = 1.0;
    let max = -1.0;

    for (
      let i = startSample;
      i < endSample && i < channel.length && i >= 0;
      i++
    ) {
      const value = channel[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }

    minValues[pixelIndex] = min;
    maxValues[pixelIndex] = max;
  }

  return {
    startTicks,
    endTicks,
    minValues,
    maxValues,
  };
};

const waveformDataMap = ref<Map<string, WaveformData>>(new Map());

const updateWaveformDataMap = async () => {
  const sources = waveformDataSources.value;
  const tempMap = new Map(waveformDataMap.value);

  // キーを作成してMapにする
  const waveformDataSourceMap = new Map(
    await Promise.all(
      sources.map((value) =>
        calculateWaveformDataKey(value).then((key) => [key, value] as const),
      ),
    ),
  );

  for (const key of tempMap.keys()) {
    if (!waveformDataSourceMap.has(key)) {
      tempMap.delete(key);
    }
  }

  for (const [key, source] of waveformDataSourceMap) {
    if (!tempMap.has(key)) {
      const waveformData = generateWaveformData(source);
      tempMap.set(key, waveformData);
    }
  }

  waveformDataMap.value = tempMap;
};

const { mounted } = useMounted();

const mutex = new Mutex({ maxPending: 1 });

watch([mounted, waveformDataSources], async ([mounted]) => {
  try {
    await using _lock = await mutex.acquire();
    if (mounted) {
      await updateWaveformDataMap();
    }
  } catch (error) {
    warn("Failed to update waveform data map.", error);
  }
});

type WaveformColorStyle = {
  color: number;
  alpha: number;
};

const waveformColorStyles: {
  light: WaveformColorStyle;
  dark: WaveformColorStyle;
} = {
  light: {
    color: 0xb0b0b0,
    alpha: 0.5,
  },
  dark: {
    color: 0x707070,
    alpha: 0.6,
  },
};

const waveformColors = computed(() =>
  isDark.value ? waveformColorStyles.dark : waveformColorStyles.light,
);

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

function drawWaveform(
  graphic: PIXI.Graphics,
  waveformData: WaveformData,
  startX: number,
  canvasWidth: number,
  canvasHeight: number,
  color: number,
  alpha: number,
) {
  const centerY = canvasHeight / 2;
  const amplitudeScale = canvasHeight / 2;

  graphic.clear();
  graphic.lineStyle(0);
  graphic.beginFill(color, alpha);

  const points: number[] = [];

  // 上半分（最大値）
  for (let i = 0; i < waveformData.maxValues.length; i++) {
    const x = startX + i;
    if (x < 0 || x > canvasWidth) {
      continue;
    }
    const y = centerY - waveformData.maxValues[i] * amplitudeScale;
    points.push(x, y);
  }

  // 下半分（最小値、逆順）
  for (let i = waveformData.minValues.length - 1; i >= 0; i--) {
    const x = startX + i;
    if (x < 0 || x > canvasWidth) {
      continue;
    }
    const y = centerY - waveformData.minValues[i] * amplitudeScale;
    points.push(x, y);
  }

  graphic.drawPolygon(points);
  graphic.endFill();
}

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

  const waveformColorsValue = toRaw(waveformColors.value);

  let graphicsIndex = 0;
  for (const waveformData of waveformDataMap.value.values()) {
    const rawWaveformData = toRaw(waveformData);

    const startTicks = rawWaveformData.startTicks;
    const endTicks = rawWaveformData.endTicks;

    // フレーズの位置とサイズを計算
    const startBaseX = tickToBaseX(startTicks, tpqn.value);
    const endBaseX = tickToBaseX(endTicks, tpqn.value);
    const startScreenX = Math.round(startBaseX * scaleX.value - props.offsetX);
    const endScreenX = Math.round(endBaseX * scaleX.value - props.offsetX);
    const screenWidth = endScreenX - startScreenX;

    // グラフィックスを取得または作成
    if (graphicsIndex >= graphics.length) {
      const newGraphic = new PIXI.Graphics();
      stage.addChild(newGraphic);
      graphics.push(newGraphic);
    }

    const graphic = graphics[graphicsIndex];
    graphicsIndex++;

    // カリング
    if (endScreenX < 0 || startScreenX > canvasWidth || screenWidth < 1) {
      graphic.renderable = false;
      continue;
    }

    // 波形を描画
    graphic.renderable = true;
    drawWaveform(
      graphic,
      rawWaveformData,
      startScreenX,
      canvasWidth,
      canvasHeight,
      waveformColorsValue.color,
      waveformColorsValue.alpha,
    );
  }

  for (let i = waveformDataMap.value.size; i < graphics.length; i++) {
    graphics[i].renderable = false;
  }

  renderer.render(stage);
};

// waveformDataMapが変更されたら再レンダリングを行う
watch(waveformDataMap, () => {
  renderInNextFrame = true;
});

// マウント、テーマ、オフセットが変更されたら再レンダリングを行う
// mountedをwatchしているので、onMountedの直後に必ず1回実行される
watch([mounted, isDark, () => props.offsetX], ([mounted]) => {
  if (mounted) {
    renderInNextFrame = true;
  }
});

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
.canvas-container {
  overflow: hidden;
  pointer-events: none; // 波形は視覚的表示のみで操作不可
  position: relative;

  contain: strict; // パフォーマンス最適化
}
</style>
