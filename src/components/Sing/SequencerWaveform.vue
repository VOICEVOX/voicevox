<template>
  <div ref="canvasContainer" class="canvas-container">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { z } from "zod";
import { ref, watch, computed, onUnmounted, onMounted } from "vue";
import * as PIXI from "pixi.js";
import { useStore } from "@/store";
import { useMounted } from "@/composables/useMounted";
import { tickToBaseX, type ViewportInfo } from "@/sing/viewHelper";
import { secondToTick, tickToSecond } from "@/sing/music";
import {
  generateWaveformPeaks,
  resamplePeaks,
  type WaveformPeaks,
} from "@/sing/waveformPeaks";
import { Mutex } from "@/helpers/mutex";
import { createLogger } from "@/helpers/log";
import { calculateHash } from "@/sing/utility";
import type { SequenceId } from "@/store/type";
import type { Tempo } from "@/domain/project/type";
import { getOrThrow } from "@/helpers/mapHelper";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

const props = defineProps<{
  viewportInfo: ViewportInfo;
}>();

const { warn } = createLogger("SequencerWaveform");

const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const tempos = computed(() => store.state.tempos);
const isDark = computed(() => store.state.currentTheme === "Dark");
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const scaleX = computed(() => store.state.sequencerZoomX);

type AudioEventId = SequenceId;

type AudioEvent = {
  readonly startTime: number;
  readonly buffer: AudioBuffer;
};

// 描画用の波形データ
type WaveformData = {
  readonly startX: number;
  readonly width: number;
  readonly minValues: Float32Array;
  readonly maxValues: Float32Array;
};

const waveformDataKeySchema = z.string().brand<"WaveformDataKey">();

type WaveformDataKey = z.infer<typeof waveformDataKeySchema>;

const computeWaveformDataKey = async (
  eventId: AudioEventId,
  event: AudioEvent,
  scaleXValue: number,
  temposValue: readonly Tempo[],
  tpqnValue: number,
): Promise<WaveformDataKey> => {
  const hash = await calculateHash({
    audioEventId: eventId,
    audioStartTime: event.startTime,
    scaleX: scaleXValue,
    tempos: temposValue,
    tpqn: tpqnValue,
  });
  return waveformDataKeySchema.parse(hash);
};

const phrasesInSelectedTrack = computed(() => {
  return new Map(
    [...store.state.phrases.entries()].filter(
      ([, phrase]) => phrase.trackId === selectedTrackId.value,
    ),
  );
});

const audioEvents = computed<ReadonlyMap<AudioEventId, AudioEvent>>(() => {
  const events = new Map<AudioEventId, AudioEvent>();
  for (const [phraseKey, phrase] of phrasesInSelectedTrack.value) {
    const sequenceId = store.state.phraseSequenceIds.get(phraseKey);
    if (sequenceId == undefined) {
      continue;
    }
    const buffer = store.getters.GET_SEQUENCE_AUDIO_BUFFER(sequenceId);
    if (buffer == undefined) {
      // NoteSequenceなどはAudioBufferを持たないため、スキップする
      continue;
    }
    events.set(sequenceId, { startTime: phrase.startTime, buffer });
  }
  return events;
});

// AudioBufferから算出した波形ピークのMap
const peaksMap = ref<ReadonlyMap<AudioEventId, WaveformPeaks>>(new Map());

const updatePeaksMap = () => {
  const audioEventsValue = audioEvents.value;

  const tempMap = new Map(peaksMap.value);

  // 不要なキーを削除
  for (const eventId of tempMap.keys()) {
    if (!audioEventsValue.has(eventId)) {
      tempMap.delete(eventId);
    }
  }

  // 新規キーについてpeaksを生成
  // NOTE: sequenceIdに対応するAudioBufferは不変なので、既存キーの再計算は不要
  for (const [eventId, event] of audioEventsValue) {
    if (!tempMap.has(eventId)) {
      // mipmapの最小のバケツサイズは、最大ズーム時にも解像度が足りる 16 を採用
      tempMap.set(eventId, generateWaveformPeaks(event.buffer, 16));
    }
  }

  peaksMap.value = tempMap;
};

// 描画用の波形データのMap
const waveformDataMap = ref<ReadonlyMap<WaveformDataKey, WaveformData>>(
  new Map(),
);

// 波形データの更新を直列化するMutex
const waveformDataMutex = new Mutex({ maxPending: 1 });

const computeWaveformData = (
  event: AudioEvent,
  peaks: WaveformPeaks,
  scaleXValue: number,
  temposValue: readonly Tempo[],
  tpqnValue: number,
): WaveformData => {
  const durationSeconds = event.buffer.length / event.buffer.sampleRate;
  const endTime = event.startTime + durationSeconds;
  const startTicks = secondToTick(event.startTime, temposValue, tpqnValue);
  const endTicks = secondToTick(endTime, temposValue, tpqnValue);

  const startBaseX = tickToBaseX(startTicks, tpqnValue);
  const endBaseX = tickToBaseX(endTicks, tpqnValue);
  const startScreenXAtZeroOffset = startBaseX * scaleXValue;
  const endScreenXAtZeroOffset = endBaseX * scaleXValue;
  // 後段のループで0除算が起きないように、1以上に丸める
  const width = Math.max(
    1,
    Math.round(endScreenXAtZeroOffset - startScreenXAtZeroOffset),
  );

  // 各ピクセル境界に対応するサンプル位置を求める
  const pixelBoundarySamples: number[] = [];
  const tickRange = endTicks - startTicks;
  for (let i = 0; i <= width; i++) {
    const pixelTick = startTicks + (tickRange * i) / width;
    const pixelTime = tickToSecond(pixelTick, temposValue, tpqnValue);
    pixelBoundarySamples.push(
      (pixelTime - event.startTime) * event.buffer.sampleRate,
    );
  }

  const { minValues, maxValues } = resamplePeaks(peaks, pixelBoundarySamples);

  return {
    startX: startScreenXAtZeroOffset,
    width,
    minValues,
    maxValues,
  };
};

const updateWaveformDataMap = async () => {
  const audioEventsValue = audioEvents.value;
  const peaksMapValue = peaksMap.value;
  const scaleXValue = scaleX.value;
  // NOTE: Tempoが型レベルでイミュータブルになっていないので、cloneしている
  const temposValue = cloneWithUnwrapProxy(tempos.value);
  const tpqnValue = tpqn.value;

  const tempMap = new Map(waveformDataMap.value);

  const keyedEvents = new Map<
    WaveformDataKey,
    { eventId: AudioEventId; event: AudioEvent }
  >();
  for (const [eventId, event] of audioEventsValue) {
    const key = await computeWaveformDataKey(
      eventId,
      event,
      scaleXValue,
      temposValue,
      tpqnValue,
    );
    keyedEvents.set(key, { eventId, event });
  }

  // 不要なキーを削除
  for (const key of tempMap.keys()) {
    if (!keyedEvents.has(key)) {
      tempMap.delete(key);
    }
  }

  // 新規キーについて描画用の波形データを計算
  for (const [key, { eventId, event }] of keyedEvents) {
    if (!tempMap.has(key)) {
      const peaks = getOrThrow(peaksMapValue, eventId);
      const waveformData = computeWaveformData(
        event,
        peaks,
        scaleXValue,
        temposValue,
        tpqnValue,
      );
      tempMap.set(key, waveformData);
    }
  }

  waveformDataMap.value = tempMap;
};

const { mounted } = useMounted();

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch([mounted, audioEvents], ([mountedValue]) => {
  if (mountedValue) {
    updatePeaksMap();
  }
});

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch(
  [mounted, audioEvents, peaksMap, scaleX, tempos, tpqn],
  async ([mountedValue]) => {
    if (mountedValue) {
      try {
        await using _lock = await waveformDataMutex.acquire();
        await updateWaveformDataMap();
      } catch (e) {
        warn("Failed to update waveform data map.", e);
      }
    }
  },
);

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

// TODO: pixi.js関連の変数をまとめてモジュール化し、isUnmountedなどのフラグを無くす
let isUnmounted = false;
let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;
const graphics: PIXI.Graphics[] = [];
let requestId: number | undefined;
let renderInNextFrame = false;

function drawWaveform(
  graphic: PIXI.Graphics,
  waveformData: WaveformData,
  startScreenX: number,
  canvasWidth: number,
  canvasHeight: number,
  color: number,
  alpha: number,
) {
  const { minValues, maxValues } = waveformData;
  const centerY = canvasHeight / 2;
  const amplitudeScale = canvasHeight / 2;
  const cullingMargin = 2;

  graphic.clear();
  const points: number[] = [];

  // 最大値をたどって上半分の頂点を作成
  for (let i = 0; i < waveformData.width; i++) {
    const x = startScreenX + i;
    if (x < -cullingMargin || x > canvasWidth + cullingMargin) {
      continue;
    }
    points.push(x, centerY - maxValues[i] * amplitudeScale);
  }

  // 最小値を逆順にたどって下半分の頂点を作成
  for (let i = waveformData.width - 1; i >= 0; i--) {
    const x = startScreenX + i;
    if (x < -cullingMargin || x > canvasWidth + cullingMargin) {
      continue;
    }
    points.push(x, centerY - minValues[i] * amplitudeScale);
  }

  // 頂点の数が4個以上なら描画
  if (points.length / 2 >= 4) {
    graphic.poly(points).fill({ color, alpha });
  }
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

  const waveformColorsValue = waveformColors.value;
  const offsetXValue = props.viewportInfo.offsetX;
  const waveformDataMapValue = waveformDataMap.value;

  let graphicsIndex = 0;
  for (const waveformData of waveformDataMapValue.values()) {
    // Graphicsは使い回し、足りない分だけ作成する
    if (graphicsIndex >= graphics.length) {
      const newGraphic = new PIXI.Graphics();
      stage.addChild(newGraphic);
      graphics.push(newGraphic);
    }
    const graphic = graphics[graphicsIndex];
    graphicsIndex++;

    const startScreenX = Math.round(waveformData.startX - offsetXValue);
    const endScreenX = startScreenX + waveformData.width;

    if (endScreenX < 0 || startScreenX > canvasWidth) {
      graphic.renderable = false;
    } else {
      graphic.renderable = true;
      drawWaveform(
        graphic,
        waveformData,
        startScreenX,
        canvasWidth,
        canvasHeight,
        waveformColorsValue.color,
        waveformColorsValue.alpha,
      );
    }
  }

  for (let i = graphicsIndex; i < graphics.length; i++) {
    graphics[i].renderable = false;
  }

  renderer.render(stage);
};

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch(
  [mounted, waveformDataMap, isDark, () => props.viewportInfo.offsetX],
  ([mountedValue]) => {
    if (mountedValue) {
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
  stage?.destroy(true);
  renderer?.destroy({ removeView: true });
  resizeObserver?.disconnect();
});
</script>

<style scoped lang="scss">
.canvas-container {
  overflow: hidden;
  pointer-events: none; // 波形は視覚的表示のみで操作不可
  position: relative;

  contain: strict; // canvasのサイズが変わるのを無視する
}
</style>
