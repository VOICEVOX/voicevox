<template>
  <div ref="canvasContainer" class="canvas-container"></div>
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
import {
  FramewiseDataSection,
  FramewiseDataSectionHash,
  calculateFramewiseDataSectionHash,
  noteNumberToBaseY,
  tickToBaseX,
} from "@/sing/viewHelper";
import { Color, LineStrip } from "@/sing/graphics/lineStrip";
import {
  onMountedOrActivated,
  onUnmountedOrDeactivated,
} from "@/composables/onMountOrActivate";
import { ExhaustiveError } from "@/type/utility";
import { createLogger } from "@/domain/frontend/log";

type PitchLine = {
  readonly frameTicksArray: number[];
  readonly lineStrip: LineStrip;
};

const originalPitchLineColor = new Color(171, 201, 176, 255);
const originalPitchLineWidth = 1.2;
const pitchEditLineColor = new Color(146, 214, 154, 255);
const pitchEditLineWidth = 2;

const props = defineProps<{
  offsetX: number;
  offsetY: number;
  previewPitchEdit?:
    | { type: "draw"; data: number[]; startFrame: number }
    | { type: "erase"; startFrame: number; frameLength: number };
}>();

const { warn, error } = createLogger("SequencerPitch");
const store = useStore();
const singingGuides = computed(() => [...store.state.singingGuides.values()]);
const pitchEditData = computed(() => {
  return store.getters.SELECTED_TRACK.pitchEditData;
});
const previewPitchEdit = computed(() => props.previewPitchEdit);
const editFrameRate = computed(() => store.state.editFrameRate);

const canvasContainer = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;

let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;
let requestId: number | undefined;
let renderInNextFrame = false;

let originalPitchDataSectionMap = new Map<
  FramewiseDataSectionHash,
  FramewiseDataSection
>();
let pitchEditDataSectionMap = new Map<
  FramewiseDataSectionHash,
  FramewiseDataSection
>();

const originalPitchLineMap = new Map<FramewiseDataSectionHash, PitchLine>();
const pitchEditLineMap = new Map<FramewiseDataSectionHash, PitchLine>();

const updatePitchLines = (
  dataSectionMap: Map<FramewiseDataSectionHash, FramewiseDataSection>,
  pitchLineMap: Map<FramewiseDataSectionHash, PitchLine>,
  pitchLineColor: Color,
  pitchLineWidth: number,
) => {
  if (stage == undefined) {
    throw new Error("stage is undefined.");
  }
  if (canvasWidth == undefined) {
    throw new Error("canvasWidth is undefined.");
  }
  const tpqn = store.state.tpqn;
  const tempos = [store.state.tempos[0]];
  const canvasWidthValue = canvasWidth;
  const zoomX = store.state.sequencerZoomX;
  const zoomY = store.state.sequencerZoomY;
  const offsetX = props.offsetX;
  const offsetY = props.offsetY;

  const removedLineStrips: LineStrip[] = [];

  // 無くなったデータ区間を調べて、そのデータ区間に対応するピッチラインを削除する
  for (const [key, pitchLine] of pitchLineMap) {
    if (!dataSectionMap.has(key)) {
      stage.removeChild(pitchLine.lineStrip.displayObject);
      removedLineStrips.push(pitchLine.lineStrip);
      pitchLineMap.delete(key);
    }
  }

  // データ区間に対応するピッチラインが無かったら生成する
  for (const [key, dataSection] of dataSectionMap) {
    if (pitchLineMap.has(key)) {
      continue;
    }
    const startFrame = dataSection.startFrame;
    const frameLength = dataSection.data.length;
    const endFrame = startFrame + frameLength;
    const frameRate = dataSection.frameRate;

    // 各フレームのticksは前もって計算しておく
    const frameTicksArray: number[] = [];
    for (let i = startFrame; i < endFrame; i++) {
      const ticks = secondToTick(i / frameRate, tempos, tpqn);
      frameTicksArray.push(ticks);
    }

    // 再利用できるLineStripがあれば再利用し、なければLineStripを作成する
    let lineStrip = removedLineStrips.pop();
    if (lineStrip != undefined) {
      if (
        !lineStrip.color.equals(pitchLineColor) ||
        lineStrip.width !== pitchLineWidth
      ) {
        throw new Error("Color or width does not match.");
      }
      lineStrip.numOfPoints = frameLength;
    } else {
      lineStrip = new LineStrip(frameLength, pitchLineColor, pitchLineWidth);
    }
    stage.addChild(lineStrip.displayObject);

    pitchLineMap.set(key, { frameTicksArray, lineStrip });
  }

  // 再利用されなかったLineStripは破棄する
  for (const lineStrip of removedLineStrips) {
    lineStrip.destroy();
  }

  // ピッチラインを更新
  for (const [key, dataSection] of dataSectionMap) {
    const pitchLine = pitchLineMap.get(key);
    if (pitchLine == undefined) {
      throw new Error("pitchLine is undefined.");
    }
    if (pitchLine.frameTicksArray.length !== dataSection.data.length) {
      throw new Error(
        "frameTicksArray.length and dataSection.length do not match.",
      );
    }

    // カリングを行う
    const startTicks = pitchLine.frameTicksArray[0];
    const startBaseX = tickToBaseX(startTicks, tpqn);
    const startX = startBaseX * zoomX - offsetX;
    const lastIndex = pitchLine.frameTicksArray.length - 1;
    const endTicks = pitchLine.frameTicksArray[lastIndex];
    const endBaseX = tickToBaseX(endTicks, tpqn);
    const endX = endBaseX * zoomX - offsetX;
    if (startX >= canvasWidthValue || endX <= 0) {
      pitchLine.lineStrip.renderable = false;
      continue;
    }
    pitchLine.lineStrip.renderable = true;

    // ポイントを計算してlineStripに設定＆更新
    for (let i = 0; i < dataSection.data.length; i++) {
      const ticks = pitchLine.frameTicksArray[i];
      const baseX = tickToBaseX(ticks, tpqn);
      const x = baseX * zoomX - offsetX;
      const freq = dataSection.data[i];
      const noteNumber = frequencyToNoteNumber(freq);
      const baseY = noteNumberToBaseY(noteNumber);
      const y = baseY * zoomY - offsetY;
      pitchLine.lineStrip.setPoint(i, x, y);
    }
    pitchLine.lineStrip.update();
  }
};

const render = () => {
  if (renderer == undefined) {
    throw new Error("renderer is undefined.");
  }
  if (stage == undefined) {
    throw new Error("stage is undefined.");
  }

  // シンガーが未設定の場合はピッチラインをすべて非表示にして終了
  const singer = store.getters.SELECTED_TRACK.singer;
  if (!singer) {
    for (const originalPitchLine of originalPitchLineMap.values()) {
      originalPitchLine.lineStrip.renderable = false;
    }
    for (const pitchEditLine of pitchEditLineMap.values()) {
      pitchEditLine.lineStrip.renderable = false;
    }
    renderer.render(stage);
    return;
  }

  // ピッチラインを更新する
  updatePitchLines(
    originalPitchDataSectionMap,
    originalPitchLineMap,
    originalPitchLineColor,
    originalPitchLineWidth,
  );
  updatePitchLines(
    pitchEditDataSectionMap,
    pitchEditLineMap,
    pitchEditLineColor,
    pitchEditLineWidth,
  );

  renderer.render(stage);
};

const generateDataSectionMap = async (data: number[], frameRate: number) => {
  // データ区間（データがある区間）の配列を生成する
  let dataSections: FramewiseDataSection[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] !== VALUE_INDICATING_NO_DATA) {
      if (i === 0 || data[i - 1] === VALUE_INDICATING_NO_DATA) {
        dataSections.push({ startFrame: i, frameRate, data: [] });
      }
      dataSections[dataSections.length - 1].data.push(data[i]);
    }
  }
  dataSections = dataSections.filter((value) => value.data.length >= 2);

  // データ区間のハッシュを計算して、ハッシュがキーのマップにする
  const dataSectionMap = new Map<
    FramewiseDataSectionHash,
    FramewiseDataSection
  >();
  for (const dataSection of dataSections) {
    const hash = await calculateFramewiseDataSectionHash(dataSection);
    dataSectionMap.set(hash, dataSection);
  }
  return dataSectionMap;
};

const updateOriginalPitchDataSectionMap = async () => {
  // 歌い方のf0を結合して1次元のデータにし、
  // 1次元のデータからデータ区間のマップを生成して、originalPitchDataSectionMapに設定する

  const unvoicedPhonemes = UNVOICED_PHONEMES;
  const frameRate = editFrameRate.value; // f0（元のピッチ）は編集フレームレートで表示する
  const singingGuidesValue = singingGuides.value;

  const tempData: number[] = [];
  for (const singingGuide of singingGuidesValue) {
    // TODO: 補間を行うようにする
    if (singingGuide.frameRate !== frameRate) {
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
    if (tempData.length < singingGuideEndFrame) {
      const valuesToPush = new Array(
        singingGuideEndFrame - tempData.length,
      ).fill(VALUE_INDICATING_NO_DATA);
      tempData.push(...valuesToPush);
    }
    const startFrame = Math.max(0, singingGuideStartFrame);
    const endFrame = singingGuideEndFrame;
    for (let i = startFrame; i < endFrame; i++) {
      const phoneme = framePhonemes[i - singingGuideStartFrame];
      const unvoiced = unvoicedPhonemes.includes(phoneme);
      if (!unvoiced) {
        tempData[i] = f0[i - singingGuideStartFrame];
      }
    }
  }

  // データ区間（ピッチのデータがある区間）のマップを生成する
  const dataSectionMap = await generateDataSectionMap(tempData, frameRate);

  originalPitchDataSectionMap = dataSectionMap;
};

const updatePitchEditDataSectionMap = async () => {
  // ピッチ編集データとプレビュー中のピッチ編集データを結合して1次元のデータにし、
  // 1次元のデータからデータ区間のマップを生成して、pitchEditDataSectionMapに設定する

  const frameRate = editFrameRate.value;
  const tempData = [...pitchEditData.value];

  // プレビュー中のピッチ編集があれば、適用する
  if (previewPitchEdit.value != undefined) {
    const previewPitchEditType = previewPitchEdit.value.type;
    if (previewPitchEditType === "draw") {
      const previewData = previewPitchEdit.value.data;
      const previewStartFrame = previewPitchEdit.value.startFrame;
      const previewEndFrame = previewStartFrame + previewData.length;
      if (tempData.length < previewEndFrame) {
        const valuesToPush = new Array(previewEndFrame - tempData.length).fill(
          VALUE_INDICATING_NO_DATA,
        );
        tempData.push(...valuesToPush);
      }
      for (let i = 0; i < previewData.length; i++) {
        tempData[previewStartFrame + i] = previewData[i];
      }
    } else if (previewPitchEditType === "erase") {
      const startFrame = previewPitchEdit.value.startFrame;
      const endFrame = Math.min(
        startFrame + previewPitchEdit.value.frameLength,
        tempData.length,
      );
      for (let i = startFrame; i < endFrame; i++) {
        tempData[i] = VALUE_INDICATING_NO_DATA;
      }
    } else {
      throw new ExhaustiveError(previewPitchEditType);
    }
  }

  // データ区間（ピッチ編集データがある区間）のマップを生成する
  const dataSectionMap = await generateDataSectionMap(tempData, frameRate);

  pitchEditDataSectionMap = dataSectionMap;
};

const asyncLock = new AsyncLock({ maxPending: 1 });

watch(
  singingGuides,
  async () => {
    asyncLock.acquire(
      "originalPitch",
      async () => {
        await updateOriginalPitchDataSectionMap();
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
  [pitchEditData, previewPitchEdit],
  async () => {
    asyncLock.acquire(
      "pitchEdit",
      async () => {
        await updatePitchEditDataSectionMap();
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
  if (!canvasContainerElement) {
    throw new Error("canvasContainerElement is null.");
  }

  canvasWidth = canvasContainerElement.clientWidth;
  canvasHeight = canvasContainerElement.clientHeight;

  const canvasElement = document.createElement("canvas");
  canvasElement.width = canvasWidth;
  canvasElement.height = canvasHeight;
  canvasContainerElement.appendChild(canvasElement);

  renderer = new PIXI.Renderer({
    view: canvasElement,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  stage = new PIXI.Container();

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
  stage?.destroy();
  originalPitchLineMap.forEach((value) => {
    value.lineStrip.destroy();
  });
  originalPitchLineMap.clear();
  pitchEditLineMap.forEach((value) => {
    value.lineStrip.destroy();
  });
  pitchEditLineMap.clear();
  renderer?.destroy(true);
  resizeObserver?.disconnect();
});
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.canvas-container {
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
}
</style>
