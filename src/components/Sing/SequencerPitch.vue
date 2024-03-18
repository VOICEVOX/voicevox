<template>
  <div ref="canvasContainer" class="canvas-container"></div>
</template>

<script setup lang="ts">
import { ref, watch, toRaw, computed, onUnmounted, onMounted } from "vue";
import * as PIXI from "pixi.js";
import { useStore } from "@/store";
import { frequencyToNoteNumber, secondToTick } from "@/sing/domain";
import { noteNumberToBaseY, tickToBaseX } from "@/sing/viewHelper";
import { LineStrip } from "@/sing/graphics/lineStrip";
import { FramePhoneme } from "@/openapi";

type VoicedSection = {
  readonly startFrame: number;
  readonly frameLength: number;
};

type PitchLine = {
  readonly startFrame: number;
  readonly frameLength: number;
  readonly frameTicksArray: number[];
  readonly lineStrip: LineStrip;
};

const pitchLineColor = [0.647, 0.831, 0.678, 1]; // RGBA
const pitchLineWidth = 1.5;

const props =
  defineProps<{ isActivated: boolean; offsetX: number; offsetY: number }>();

const store = useStore();
const queries = computed(() => {
  const phrases = [...store.state.phrases.values()];
  return phrases.map((value) => value.query);
});

const canvasContainer = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;

let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;
let requestId: number | undefined;
let renderInNextFrame = false;

const pitchLinesMap = new Map<string, PitchLine[]>();

const searchVoicedSections = (phonemes: FramePhoneme[]) => {
  const voicedSections: VoicedSection[] = [];
  let currentFrame = 0;
  let voicedSectionStartFrame = 0;
  let voicedSectionFrameLength = 0;
  // NOTE: 一旦、pauではない区間を有声区間とする
  for (let i = 0; i < phonemes.length; i++) {
    const phoneme = phonemes[i];
    if (phoneme.phoneme !== "pau") {
      if (i === 0 || phonemes[i - 1].phoneme === "pau") {
        voicedSectionStartFrame = currentFrame;
      }
      voicedSectionFrameLength += phoneme.frameLength;
      if (i + 1 === phonemes.length || phonemes[i + 1].phoneme === "pau") {
        voicedSections.push({
          startFrame: voicedSectionStartFrame,
          frameLength: voicedSectionFrameLength,
        });
      }
    }
    currentFrame += phoneme.frameLength;
  }
  return voicedSections;
};

const render = () => {
  if (canvasWidth == undefined) {
    throw new Error("canvasWidth is undefined.");
  }
  if (canvasHeight == undefined) {
    throw new Error("canvasHeight is undefined.");
  }
  if (!renderer) {
    throw new Error("renderer is undefined.");
  }
  if (!stage) {
    throw new Error("stage is undefined.");
  }

  const phrases = toRaw(store.state.phrases);
  const zoomX = store.state.sequencerZoomX;
  const zoomY = store.state.sequencerZoomY;
  const offsetX = props.offsetX;
  const offsetY = props.offsetY;

  // 無くなったフレーズを調べて、そのフレーズに対応するピッチラインを削除する
  for (const [phraseKey, pitchLines] of pitchLinesMap) {
    if (!phrases.has(phraseKey)) {
      for (const pitchLine of pitchLines) {
        stage.removeChild(pitchLine.lineStrip.displayObject);
        pitchLine.lineStrip.destroy();
      }
      pitchLinesMap.delete(phraseKey);
    }
  }
  // ピッチラインの生成・更新を行う
  for (const [phraseKey, phrase] of phrases) {
    if (!phrase.singer || !phrase.query || phrase.startTime == undefined) {
      continue;
    }
    const tempos = [toRaw(phrase.tempos[0])];
    const tpqn = phrase.tpqn;
    const startTime = phrase.startTime;
    const f0 = phrase.query.f0;
    const phonemes = phrase.query.phonemes;
    const engineId = phrase.singer.engineId;
    const frameRate = store.state.engineManifests[engineId].frameRate;
    let pitchLines = pitchLinesMap.get(phraseKey);

    // フレーズに対応するピッチラインが無かったら生成する
    if (!pitchLines) {
      // 有声区間を調べる
      const voicedSections = searchVoicedSections(phonemes);
      // 有声区間のピッチラインを生成
      pitchLines = [];
      for (const voicedSection of voicedSections) {
        const startFrame = voicedSection.startFrame;
        const frameLength = voicedSection.frameLength;
        // 各フレームのticksは前もって計算しておく
        const frameTicksArray: number[] = [];
        for (let j = 0; j < frameLength; j++) {
          const ticks = secondToTick(
            startTime + (startFrame + j) / frameRate,
            tempos,
            tpqn
          );
          frameTicksArray.push(ticks);
        }
        const lineStrip = new LineStrip(
          frameLength,
          pitchLineColor,
          pitchLineWidth
        );
        pitchLines.push({
          startFrame,
          frameLength,
          frameTicksArray,
          lineStrip,
        });
      }
      // lineStripをステージに追加
      for (const pitchLine of pitchLines) {
        stage.addChild(pitchLine.lineStrip.displayObject);
      }
      pitchLinesMap.set(phraseKey, pitchLines);
    }

    // ピッチラインを更新
    for (let i = 0; i < pitchLines.length; i++) {
      const pitchLine = pitchLines[i];

      // カリングを行う
      const startTicks = pitchLine.frameTicksArray[0];
      const startBaseX = tickToBaseX(startTicks, tpqn);
      const startX = startBaseX * zoomX - offsetX;
      const lastIndex = pitchLine.frameLength - 1;
      const endTicks = pitchLine.frameTicksArray[lastIndex];
      const endBaseX = tickToBaseX(endTicks, tpqn);
      const endX = endBaseX * zoomX - offsetX;
      if (startX >= canvasWidth || endX <= 0) {
        pitchLine.lineStrip.renderable = false;
        continue;
      }
      pitchLine.lineStrip.renderable = true;

      // ポイントを計算してlineStripに設定＆更新
      for (let j = 0; j < pitchLine.frameLength; j++) {
        const ticks = pitchLine.frameTicksArray[j];
        const baseX = tickToBaseX(ticks, tpqn);
        const x = baseX * zoomX - offsetX;
        const freq = f0[pitchLine.startFrame + j];
        const noteNumber = frequencyToNoteNumber(freq);
        const baseY = noteNumberToBaseY(noteNumber);
        const y = baseY * zoomY - offsetY;
        pitchLine.lineStrip.setPoint(j, x, y);
      }
      pitchLine.lineStrip.update();
    }
  }
  renderer.render(stage);
};

watch(queries, () => {
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
  }
);

let isInstantiated = false;

const initialize = () => {
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
  });
  stage = new PIXI.Container();

  const callback = () => {
    if (renderInNextFrame) {
      render();
      renderInNextFrame = false;
    }
    requestId = window.requestAnimationFrame(callback);
  };
  renderInNextFrame = true;
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

  isInstantiated = true;
};

const cleanUp = () => {
  if (requestId != undefined) {
    window.cancelAnimationFrame(requestId);
  }
  stage?.destroy();
  pitchLinesMap.forEach((pitchLines) => {
    pitchLines.forEach((pitchLine) => {
      pitchLine.lineStrip.destroy();
    });
  });
  pitchLinesMap.clear();
  renderer?.destroy(true);
  resizeObserver?.disconnect();

  isInstantiated = false;
};

let isMounted = false;

onMounted(() => {
  isMounted = true;
  if (props.isActivated) {
    initialize();
  }
});

watch(
  () => props.isActivated,
  (isActivated) => {
    if (!isMounted) {
      return;
    }
    if (isActivated && !isInstantiated) {
      initialize();
    }
    if (!isActivated && isInstantiated) {
      cleanUp();
    }
  }
);

onUnmounted(() => {
  if (isInstantiated) {
    cleanUp();
  }
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.canvas-container {
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
}
</style>
