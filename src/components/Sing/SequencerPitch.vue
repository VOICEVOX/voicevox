<template>
  <div ref="canvasContainer" class="canvas-container">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import * as PIXI from "pixi.js";
import AsyncLock from "async-lock";
import { useStore } from "@/store";
import {
  UNVOICED_PHONEMES,
  VALUE_INDICATING_NO_DATA,
  convertToFramePhonemes,
  frequencyToNoteNumber,
  secondToTick,
} from "@/sing/domain";
import { noteNumberToBaseY, tickToBaseX } from "@/sing/viewHelper";
import { Color } from "@/sing/graphics/lineStrip";
import {
  onMountedOrActivated,
  onUnmountedOrDeactivated,
} from "@/composables/onMountOrActivate";
import { ExhaustiveError } from "@/type/utility";
import { createLogger } from "@/helpers/log";
import { getLast } from "@/sing/utility";
import { getOrThrow } from "@/helpers/mapHelper";
import { EditorFrameAudioQuery } from "@/store/type";
import {
  calculatePitchDataHash,
  PitchData,
  PitchDataHash,
  PitchLine,
  ViewInfo,
} from "@/sing/graphics/pitchLine";

const props = defineProps<{
  offsetX: number;
  offsetY: number;
  previewPitchEdit?:
    | { type: "draw"; data: number[]; startFrame: number }
    | { type: "erase"; startFrame: number; frameLength: number };
}>();

const { warn, error } = createLogger("SequencerPitch");
const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const isDark = computed(() => store.state.currentTheme === "Dark");
const tempos = computed(() => store.state.tempos);
const pitchEditData = computed(() => {
  return store.getters.SELECTED_TRACK.pitchEditData;
});
const previewPitchEdit = computed(() => props.previewPitchEdit);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const editorFrameRate = computed(() => store.state.editorFrameRate);
const singingGuidesInSelectedTrack = computed(() => {
  const singingGuides: {
    query: EditorFrameAudioQuery;
    startTime: number;
  }[] = [];
  for (const phrase of store.state.phrases.values()) {
    if (phrase.trackId !== selectedTrackId.value) {
      continue;
    }
    if (phrase.queryKey == undefined) {
      continue;
    }
    const phraseQuery = getOrThrow(store.state.phraseQueries, phrase.queryKey);
    singingGuides.push({
      startTime: phrase.startTime,
      query: phraseQuery,
    });
  }
  return singingGuides;
});

// NOTE: ピッチラインの色をテーマに応じて調節する
// 動的カラースキーマに対応後、テーマに応じた色をオブジェクトから取得できるようにする

const originalPitchLineColorLight = new Color(156, 158, 156, 255);
const originalPitchLineColorDark = new Color(114, 116, 114, 255);
const pitchEditLineColorLight = new Color(0, 167, 63, 255);
const pitchEditLineColorDark = new Color(95, 188, 117, 255);

const originalPitchLineColor = computed(() => {
  return isDark.value
    ? originalPitchLineColorDark
    : originalPitchLineColorLight;
});
const pitchEditLineColor = computed(() => {
  return isDark.value ? pitchEditLineColorDark : pitchEditLineColorLight;
});
const isPitchLineVisible = computed(() => {
  return store.getters.SELECTED_TRACK.singer != undefined;
});

const originalPitchLine = new PitchLine(
  originalPitchLineColor.value,
  1.125,
  isPitchLineVisible.value,
);
const pitchEditLine = new PitchLine(
  pitchEditLineColor.value,
  2.25,
  isPitchLineVisible.value,
);

const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;

let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;
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

  const viewInfo: ViewInfo = {
    viewportWidth: canvasWidth,
    zoomX: store.state.sequencerZoomX,
    zoomY: store.state.sequencerZoomY,
    offsetX: props.offsetX,
    offsetY: props.offsetY,
  };

  originalPitchLine.color = originalPitchLineColor.value;
  pitchEditLine.color = pitchEditLineColor.value;

  originalPitchLine.isVisible = isPitchLineVisible.value;
  pitchEditLine.isVisible = isPitchLineVisible.value;

  originalPitchLine.update(viewInfo);
  pitchEditLine.update(viewInfo);

  renderer.render(stage);
};

const toPitchDataMap = async (framewiseData: number[], frameRate: number) => {
  const pitchDataArray: PitchData[] = [];
  for (let i = 0; i < framewiseData.length; i++) {
    if (framewiseData[i] === VALUE_INDICATING_NO_DATA) {
      continue;
    }
    if (i === 0 || framewiseData[i - 1] === VALUE_INDICATING_NO_DATA) {
      pitchDataArray.push([]);
    }
    const lastPitchData = getLast(pitchDataArray);
    const seconds = i / frameRate;
    const ticks = secondToTick(seconds, tempos.value, tpqn.value);
    const baseX = tickToBaseX(ticks, tpqn.value);
    const freq = framewiseData[i];
    const noteNumber = frequencyToNoteNumber(freq);
    const baseY = noteNumberToBaseY(noteNumber);
    lastPitchData.push({ baseX, baseY });
  }
  const pitchDataMap = new Map<PitchDataHash, PitchData>();
  for (const pitchData of pitchDataArray) {
    if (pitchData.length < 2) {
      continue;
    }
    const hash = await calculatePitchDataHash(pitchData);
    pitchDataMap.set(hash, pitchData);
  }
  return pitchDataMap;
};

const generateOriginalPitchDataMap = async () => {
  const unvoicedPhonemes = UNVOICED_PHONEMES;
  const frameRate = editorFrameRate.value; // f0（元のピッチ）はエディターのフレームレートで表示する

  // 選択中のトラックで使われている歌い方のf0を結合してピッチデータを生成する
  const framewiseData = [];
  for (const singingGuide of singingGuidesInSelectedTrack.value) {
    // TODO: 補間を行うようにする
    if (singingGuide.query.frameRate !== frameRate) {
      throw new Error(
        "The frame rate between the singing guide and the edit does not match.",
      );
    }
    const phonemes = singingGuide.query.phonemes;
    if (phonemes.length === 0) {
      throw new Error("phonemes.length is 0.");
    }
    const f0 = singingGuide.query.f0;

    // 各フレームの音素の配列を生成する
    const framePhonemes = convertToFramePhonemes(phonemes);
    if (f0.length !== framePhonemes.length) {
      throw new Error("f0.length and framePhonemes.length do not match.");
    }

    // 歌い方の開始フレームと終了フレームを計算する
    const singingGuideFrameLength = f0.length;
    const singingGuideStartFrame = Math.round(
      singingGuide.startTime * frameRate,
    );
    const singingGuideEndFrame =
      singingGuideStartFrame + singingGuideFrameLength;

    // 無声子音区間以外のf0をtempDataにコピーする
    // NOTE: 無声子音区間は音程が無く、f0の値が大きく上下するので表示しない
    if (framewiseData.length < singingGuideEndFrame) {
      const valuesToPush = new Array(
        singingGuideEndFrame - framewiseData.length,
      ).fill(VALUE_INDICATING_NO_DATA);
      framewiseData.push(...valuesToPush);
    }
    const startFrame = Math.max(0, singingGuideStartFrame);
    const endFrame = singingGuideEndFrame;
    for (let i = startFrame; i < endFrame; i++) {
      const phoneme = framePhonemes[i - singingGuideStartFrame];
      const unvoiced = unvoicedPhonemes.includes(phoneme);
      if (!unvoiced) {
        framewiseData[i] = f0[i - singingGuideStartFrame];
      }
    }
  }
  return await toPitchDataMap(framewiseData, frameRate);
};

const generatePitchEditDataMap = async () => {
  const frameRate = editorFrameRate.value;

  const framewiseData = [...pitchEditData.value];
  // プレビュー中のピッチ編集があれば、適用する
  if (previewPitchEdit.value != undefined) {
    const previewPitchEditType = previewPitchEdit.value.type;
    if (previewPitchEditType === "draw") {
      const previewData = previewPitchEdit.value.data;
      const previewStartFrame = previewPitchEdit.value.startFrame;
      const previewEndFrame = previewStartFrame + previewData.length;
      if (framewiseData.length < previewEndFrame) {
        const valuesToPush = new Array(
          previewEndFrame - framewiseData.length,
        ).fill(VALUE_INDICATING_NO_DATA);
        framewiseData.push(...valuesToPush);
      }
      for (let i = 0; i < previewData.length; i++) {
        framewiseData[previewStartFrame + i] = previewData[i];
      }
    } else if (previewPitchEditType === "erase") {
      const startFrame = previewPitchEdit.value.startFrame;
      const endFrame = Math.min(
        startFrame + previewPitchEdit.value.frameLength,
        framewiseData.length,
      );
      for (let i = startFrame; i < endFrame; i++) {
        framewiseData[i] = VALUE_INDICATING_NO_DATA;
      }
    } else {
      throw new ExhaustiveError(previewPitchEditType);
    }
  }
  return await toPitchDataMap(framewiseData, frameRate);
};

const asyncLock = new AsyncLock({ maxPending: 1 });

watch(
  [singingGuidesInSelectedTrack, tempos, tpqn],
  async () => {
    asyncLock.acquire(
      "originalPitch",
      async () => {
        originalPitchLine.pitchDataMap = await generateOriginalPitchDataMap();
        renderInNextFrame = true;
      },
      (err) => {
        if (err != undefined) {
          warn(`An error occurred.`, err);
        }
      },
    );
  },
  { immediate: true },
);

watch(
  [pitchEditData, previewPitchEdit, tempos, tpqn],
  async () => {
    asyncLock.acquire(
      "pitchEdit",
      async () => {
        pitchEditLine.pitchDataMap = await generatePitchEditDataMap();
        renderInNextFrame = true;
      },
      (err) => {
        if (err != undefined) {
          warn(`An error occurred.`, err);
        }
      },
    );
  },
  { immediate: true },
);

watch(isDark, () => {
  renderInNextFrame = true;
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

onMountedOrActivated(() => {
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

  stage.addChild(originalPitchLine.displayObject);
  stage.addChild(pitchEditLine.displayObject);

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
  renderInNextFrame = true;

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

onUnmountedOrDeactivated(() => {
  if (requestId != undefined) {
    window.cancelAnimationFrame(requestId);
  }
  originalPitchLine.destroy();
  pitchEditLine.destroy();
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

  contain: strict; // canvasのサイズが変わるのを無視する
}
</style>
