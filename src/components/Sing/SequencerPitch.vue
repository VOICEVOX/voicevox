<template>
  <div ref="canvasContainer" class="canvas-container"></div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import * as PIXI from "pixi.js";
import { useStore } from "@/store";
import { frequencyToNoteNumber, secondToTick } from "@/sing/domain";
import { noteNumberToBaseY, tickToBaseX } from "@/sing/viewHelper";
import { LineStrip } from "@/sing/graphics/lineStrip";
import { FramePhoneme } from "@/openapi";
import {
  onMountedOrActivated,
  onUnmountedOrDeactivated,
} from "@/composables/onMountOrActivate";
import { SingingGuideSourceHash } from "@/store/type";
import DefaultMap from "@/helpers/DefaultMap";
import { createLogger } from "@/domain/frontend/log";
import { TrackId } from "@/type/preload";

const { info } = createLogger("sequencerPitch");

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

const props = defineProps<{ offsetX: number; offsetY: number }>();

const store = useStore();

const containers = new DefaultMap<TrackId, PIXI.Container>((trackId) => {
  const container = new PIXI.Container();
  if (stage == undefined) {
    throw new Error("stage is undefined.");
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore TypeScript 5で修正される。
  // ts-expect-errorは使うとtsserverが怒る（tsserverはTypeScript 5なのでunused判定になる）ので使わない
  stage.addChild(container);

  info(`Container created for track ${trackId}`);
  return container;
});

// トラックが削除されたらContainerも削除する
watch(
  () => store.state.tracks,
  () => {
    for (const [trackId, container] of containers) {
      if (!store.state.tracks.some((track) => track.id === trackId)) {
        container.destroy();
        containers.delete(trackId);
        info(`Container destroyed for track ${trackId}`);
      }
    }
  }
);

const selectedTrackId = computed(() => store.state.selectedTrackId);

// トラックが選択されたらContainerの表示を切り替える
watch(
  selectedTrackId,
  () => {
    for (const [trackId, container] of containers) {
      container.visible = trackId === selectedTrackId.value;
    }
  },
  { immediate: true }
);

const queries = computed(() => {
  const singingGuides = [...store.state.singingGuides.values()];
  return singingGuides.map((value) => value.query);
});

const canvasContainer = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;

let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;
let requestId: number | undefined;
let renderInNextFrame = false;

const pitchLinesMap = new Map<
  SingingGuideSourceHash,
  { pitchLines: PitchLine[]; trackId: TrackId }
>();

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
  if (renderer == undefined) {
    throw new Error("renderer is undefined.");
  }
  if (stage == undefined) {
    throw new Error("stage is undefined.");
  }

  const tpqn = store.state.tpqn;
  const tempos = [store.state.tempos[0]];
  const singingGuides = store.state.singingGuides;
  const zoomX = store.state.sequencerZoomX;
  const zoomY = store.state.sequencerZoomY;
  const offsetX = props.offsetX;
  const offsetY = props.offsetY;

  // 無くなったフレーズを調べて、そのフレーズに対応するピッチラインを削除する
  for (const [singingGuideKey, { pitchLines, trackId }] of pitchLinesMap) {
    if (!singingGuides.has(singingGuideKey)) {
      const container = containers.get(trackId);
      for (const pitchLine of pitchLines) {
        container.removeChild(pitchLine.lineStrip.displayObject);
        pitchLine.lineStrip.destroy();
      }
      pitchLinesMap.delete(singingGuideKey);
    }
  }
  // シンガーが未設定の場合はピッチラインをすべて非表示にして終了
  for (const track of store.state.tracks) {
    if (track.singer == undefined) {
      const container = containers.get(track.id);
      container.visible = false;
    }
  }
  // ピッチラインの生成・更新を行う
  for (const [singingGuideKey, singingGuide] of singingGuides) {
    const f0 = singingGuide.query.f0;
    const frameRate = singingGuide.frameRate;
    const startTime = singingGuide.startTime;
    const phonemes = singingGuide.query.phonemes;

    // フレーズに対応するピッチラインが無かったら生成する
    if (!pitchLinesMap.has(singingGuideKey)) {
      const phrase = store.state.phrases.get(singingGuide.phraseId);
      if (phrase == undefined) {
        throw new Error(`Phrase not found: ${singingGuide.phraseId}`);
      }
      // 有声区間を調べる
      const voicedSections = searchVoicedSections(phonemes);
      // 有声区間のピッチラインを生成
      const newPitchLines = [];
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
        newPitchLines.push({
          startFrame,
          frameLength,
          frameTicksArray,
          lineStrip,
          // trackId: phrase.trackId,
        });
      }
      const container = containers.get(phrase.trackId);
      // lineStripをステージに追加
      for (const pitchLine of newPitchLines) {
        container.addChild(pitchLine.lineStrip.displayObject);
      }
      pitchLinesMap.set(singingGuideKey, {
        pitchLines: newPitchLines,
        trackId: phrase.trackId,
      });
    }
    const { pitchLines } = pitchLinesMap.get(singingGuideKey) ?? {
      pitchLines: undefined,
    };
    if (pitchLines == undefined) {
      throw new Error("pitchLines is undefined.");
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

watch([queries, selectedTrackId], () => {
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

    if (
      canvasContainerWidth > 0 &&
      canvasContainerHeight > 0 &&
      (canvasWidth !== canvasContainerWidth ||
        canvasHeight !== canvasContainerHeight)
    ) {
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
  pitchLinesMap.forEach(({ pitchLines }) => {
    pitchLines.forEach((pitchLine) => {
      pitchLine.lineStrip.destroy();
    });
  });
  pitchLinesMap.clear();
  renderer?.destroy(true);
  resizeObserver?.disconnect();
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
