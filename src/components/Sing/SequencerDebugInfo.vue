<template>
  <div ref="canvasContainer" class="canvas-container">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted, onMounted } from "vue";
import * as PIXI from "pixi.js";
import AsyncLock from "async-lock";
import { useStore } from "@/store";
import { useMounted } from "@/composables/useMounted";
import {
  applyPitchEdit,
  frequencyToNoteNumber,
  secondToTick,
} from "@/sing/domain";
import { noteNumberToBaseY, tickToBaseX } from "@/sing/viewHelper";
import { Color } from "@/sing/graphics/lineStrip";
import { createLogger } from "@/helpers/log";
import { getOrThrow } from "@/helpers/mapHelper";
import {
  calculatePitchDataHash,
  PitchData,
  PitchDataHash,
  PitchLine,
  ViewInfo,
} from "@/sing/graphics/pitchLine";
import { FramePhoneme } from "@/openapi";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

const props = defineProps<{
  offsetX: number;
  offsetY: number;
}>();

const { warn, error } = createLogger("SequencerDebugInfo");
const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const tempos = computed(() => store.state.tempos);
const pitchEditData = computed(() => {
  return store.getters.SELECTED_TRACK.pitchEditData;
});
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const editorFrameRate = computed(() => store.state.editorFrameRate);
const singingGuidesInSelectedTrack = computed(() => {
  const singingGuides: {
    startTime: number;
    frameRate: number;
    phonemes: FramePhoneme[];
    f0: number[];
    editedF0: number[];
  }[] = [];
  for (const phrase of store.state.phrases.values()) {
    if (phrase.trackId !== selectedTrackId.value) {
      continue;
    }
    if (phrase.queryKey == undefined) {
      continue;
    }
    if (phrase.singingPitchKey == undefined) {
      continue;
    }
    const phraseQuery = getOrThrow(store.state.phraseQueries, phrase.queryKey);
    const phraseSingingPitch = getOrThrow(
      store.state.phraseSingingPitches,
      phrase.singingPitchKey,
    );

    const clonedQuery = cloneWithUnwrapProxy(phraseQuery);
    clonedQuery.f0 = cloneWithUnwrapProxy(phraseSingingPitch);
    if (pitchEditData.value != undefined) {
      applyPitchEdit(
        clonedQuery,
        phrase.startTime,
        pitchEditData.value,
        editorFrameRate.value,
      );
    }

    singingGuides.push({
      startTime: phrase.startTime,
      frameRate: phraseQuery.frameRate,
      phonemes: phraseQuery.phonemes,
      f0: phraseSingingPitch,
      editedF0: clonedQuery.f0,
    });
  }
  return singingGuides;
});

const pitchLineColor1 = new Color(252, 113, 43, 255);
const pitchLineColor2 = new Color(43, 134, 252, 255);

const isPitchLineVisible = computed(() => {
  return store.getters.SELECTED_TRACK.singer != undefined;
});

const { mounted } = useMounted();

const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;

let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;
let pitchLine1: PitchLine | undefined;
let pitchLine2: PitchLine | undefined;
let requestId: number | undefined;
let renderInNextFrame = false;

const render = () => {
  if (renderer == undefined) {
    throw new Error("renderer is undefined.");
  }
  if (stage == undefined) {
    throw new Error("stage is undefined.");
  }
  if (pitchLine1 == undefined) {
    throw new Error("pitchLine1 is undefined.");
  }
  if (pitchLine2 == undefined) {
    throw new Error("pitchLine2 is undefined.");
  }
  if (canvasWidth == undefined) {
    throw new Error("canvasWidth is undefined.");
  }

  const viewInfo: ViewInfo = {
    viewportWidth: canvasWidth,
    zoomX: store.state.sequencerZoomX,
    zoomY: store.state.sequencerZoomY,
    offsetX: props.offsetX,
    offsetY: props.offsetY,
  };

  pitchLine1.isVisible = isPitchLineVisible.value;
  pitchLine2.isVisible = isPitchLineVisible.value;

  pitchLine1.update(viewInfo);
  pitchLine2.update(viewInfo);

  renderer.render(stage);
};

const generatePitchDataMap = async () => {
  const frameRate = editorFrameRate.value; // f0（元のピッチ）はエディターのフレームレートで表示する

  // 選択中のトラックで使われている歌い方のf0を結合してピッチデータを生成する
  const pitchDataArray: PitchData[] = [];
  for (const singingGuide of singingGuidesInSelectedTrack.value) {
    // TODO: 補間を行うようにする
    if (singingGuide.frameRate !== frameRate) {
      throw new Error(
        "The frame rate between the singing guide and the edit does not match.",
      );
    }
    const phonemes = singingGuide.phonemes;
    if (phonemes.length === 0) {
      throw new Error("phonemes.length is 0.");
    }
    const f0 = singingGuide.editedF0;

    // 歌い方の開始フレームと終了フレームを計算する
    const singingGuideFrameLength = f0.length;
    const singingGuideStartFrame = Math.round(
      singingGuide.startTime * frameRate,
    );
    const singingGuideEndFrame =
      singingGuideStartFrame + singingGuideFrameLength;

    const startFrame = Math.max(0, singingGuideStartFrame);
    const endFrame = singingGuideEndFrame;

    const pitchData: PitchData = [];
    for (let i = startFrame; i < endFrame; i++) {
      const seconds = i / frameRate;
      const ticks = secondToTick(seconds, tempos.value, tpqn.value);
      const baseX = tickToBaseX(ticks, tpqn.value);

      const freq = f0[i - singingGuideStartFrame];
      const noteNumber = frequencyToNoteNumber(freq);
      const baseY = noteNumberToBaseY(noteNumber);

      pitchData.push({ baseX, baseY });
    }
    pitchDataArray.push(pitchData);
  }

  let flipFlop = true;
  const pitchDataMap1 = new Map<PitchDataHash, PitchData>();
  const pitchDataMap2 = new Map<PitchDataHash, PitchData>();
  for (const pitchData of pitchDataArray) {
    if (pitchData.length < 2) {
      continue;
    }
    const hash = await calculatePitchDataHash(pitchData);
    if (flipFlop) {
      pitchDataMap1.set(hash, pitchData);
    } else {
      pitchDataMap2.set(hash, pitchData);
    }
    flipFlop = !flipFlop;
  }

  return [pitchDataMap1, pitchDataMap2] as const;
};

const updatePitchLineDataMap = async () => {
  if (pitchLine1 == undefined) {
    throw new Error("pitchLine1 is undefined.");
  }
  if (pitchLine2 == undefined) {
    throw new Error("pitchLine2 is undefined.");
  }
  const pitchDataMaps = await generatePitchDataMap();
  pitchLine1.pitchDataMap = pitchDataMaps[0];
  pitchLine2.pitchDataMap = pitchDataMaps[1];
  renderInNextFrame = true;
};

const asyncLock = new AsyncLock({ maxPending: 1 });

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch([mounted, singingGuidesInSelectedTrack, tempos, tpqn], ([mounted]) => {
  asyncLock.acquire(
    "pitch",
    async () => {
      if (mounted) {
        await updatePitchLineDataMap();
      }
    },
    (err) => {
      if (err != undefined) {
        warn(`An error occurred.`, err);
      }
    },
  );
});

watch(
  () => [
    store.state.sequencerZoomX,
    store.state.sequencerZoomY,
    props.offsetX,
    props.offsetY,
  ],
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
  pitchLine1 = new PitchLine(pitchLineColor1, 1.125, isPitchLineVisible.value);
  pitchLine2 = new PitchLine(pitchLineColor2, 1.125, isPitchLineVisible.value);

  stage.addChild(pitchLine1.displayObject);
  stage.addChild(pitchLine2.displayObject);

  // webGLVersionをチェックする
  // 2未満の場合、ピッチの表示ができないのでエラーとしてロギングする
  const webGLVersion = renderer.context.webGLVersion;
  if (webGLVersion < 2) {
    error(`webGLVersion is less than 2. webGLVersion: ${webGLVersion}`);
  }

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
  pitchLine1?.destroy();
  pitchLine2?.destroy();
  stage?.destroy();
  renderer?.destroy(true);
  resizeObserver?.disconnect();
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.canvas-container {
  overflow: hidden;
  z-index: vars.$z-index-sing-pitch;
  pointer-events: none;
  position: relative;
  height: 100%;

  contain: strict; // canvasのサイズが変わるのを無視する
}
</style>
