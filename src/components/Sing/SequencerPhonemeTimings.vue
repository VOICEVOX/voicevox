<template>
  <div ref="canvasContainer" class="canvas-container">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted, onMounted } from "vue";
import * as PIXI from "pixi.js";
import { useStore } from "@/store";
import { useMounted } from "@/composables/useMounted";
import { secondToTick } from "@/sing/domain";
import { tickToBaseX } from "@/sing/viewHelper";
import { Color, LineStrip } from "@/sing/graphics/lineStrip";
import { createLogger } from "@/helpers/log";
import { getNext, getPrev } from "@/sing/utility";
import { getOrThrow } from "@/helpers/mapHelper";
import { EditorFrameAudioQuery } from "@/store/type";
import { UnreachableError } from "@/type/utility";

type LineStripStyle = {
  color: Color;
  width: number;
};

type PhraseInfo = Readonly<{
  startTime: number;
  query?: EditorFrameAudioQuery;
}>;

type PhonemeInfo = Readonly<{
  startTime: number;
  phoneme: string;
}>;

type ViewportInfo = {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
  readonly height: number;
};

const props = defineProps<{
  offsetX: number;
  offsetY: number;
}>();

const { error } = createLogger("SequencerPhonemeTimings");
const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const isDark = computed(() => store.state.currentTheme === "Dark");
const tempos = computed(() => store.state.tempos);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const phraseInfosInSelectedTrack = computed(() => {
  const phraseInfos: PhraseInfo[] = [];
  for (const phrase of store.state.phrases.values()) {
    if (phrase.trackId !== selectedTrackId.value) {
      continue;
    }
    let query: EditorFrameAudioQuery | undefined = undefined;
    if (phrase.queryKey != undefined) {
      query = getOrThrow(store.state.phraseQueries, phrase.queryKey);
    }
    phraseInfos.push({ startTime: phrase.startTime, query });
  }
  return phraseInfos;
});

// NOTE: 音素タイミングラインの色をテーマに応じて調節する
// 動的カラースキーマに対応後、テーマに応じた色をオブジェクトから取得できるようにする

const phonemeTimingLineStyles: {
  light: LineStripStyle;
  dark: LineStripStyle;
} = {
  light: {
    color: new Color(156, 158, 156, 255),
    width: 1,
  },
  dark: {
    color: new Color(114, 116, 114, 255),
    width: 1,
  },
};

const phonemeTextStyles: {
  light: PIXI.TextStyle;
  dark: PIXI.TextStyle;
} = {
  light: new PIXI.TextStyle({ fill: "#9c9e9c", fontSize: 18 }),
  dark: new PIXI.TextStyle({ fill: "#727472", fontSize: 18 }),
};

const { mounted } = useMounted();

const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;

let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;
let lineStrips: LineStrip[] = [];
const textsMap = new Map<string, PIXI.Text[]>();
const textContainersMap = new Map<PIXI.Text, PIXI.Container>();
const textMasksMap = new Map<PIXI.Text, PIXI.Graphics>();
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
  if (canvasHeight == undefined) {
    throw new Error("canvasHeight is undefined.");
  }

  const viewportInfo: ViewportInfo = {
    scaleX: store.state.sequencerZoomX,
    scaleY: store.state.sequencerZoomY,
    offsetX: props.offsetX,
    offsetY: props.offsetY,
    width: canvasWidth,
    height: canvasHeight,
  };
  const currentPhonemeTimingLineStyle = isDark.value
    ? phonemeTimingLineStyles.dark
    : phonemeTimingLineStyles.light;
  const currentTextStyle = isDark.value
    ? phonemeTextStyles.dark
    : phonemeTextStyles.light;

  const phonemeInfos: PhonemeInfo[] = [];

  for (const phraseInfo of phraseInfosInSelectedTrack.value) {
    const phraseQuery = phraseInfo.query;
    if (phraseQuery == undefined) {
      continue;
    }

    // カリング
    const phraseStartTime = phraseInfo.startTime;
    const phraseStartTicks = secondToTick(
      phraseStartTime,
      tempos.value,
      tpqn.value,
    );
    const phraseStartX =
      tickToBaseX(phraseStartTicks, tpqn.value) * viewportInfo.scaleX -
      viewportInfo.offsetX;
    const phraseFrameLength = phraseQuery.phonemes.reduce(
      (accFrame, phoneme) => accFrame + phoneme.frameLength,
      0,
    );
    const phraseEndTime =
      phraseStartTime + phraseFrameLength / phraseQuery.frameRate;
    const phraseEndTicks = secondToTick(
      phraseEndTime,
      tempos.value,
      tpqn.value,
    );
    const phraseEndX =
      tickToBaseX(phraseEndTicks, tpqn.value) * viewportInfo.scaleX -
      viewportInfo.offsetX;
    if (phraseStartX > viewportInfo.width || phraseEndX < 0) {
      continue;
    }

    let phonemeStartFrame = 0;
    for (let i = 0; i < phraseQuery.phonemes.length; i++) {
      const phoneme = phraseQuery.phonemes[i];
      const prevPhoneme = getPrev(phraseQuery.phonemes, i);

      if (
        phoneme.phoneme !== "pau" ||
        (prevPhoneme != undefined && prevPhoneme.phoneme !== "pau")
      ) {
        const phonemeStartTime =
          phraseStartTime + phonemeStartFrame / phraseQuery.frameRate;

        phonemeInfos.push({
          startTime: phonemeStartTime,
          phoneme: phoneme.phoneme,
        });
      }

      phonemeStartFrame += phoneme.frameLength;
    }
  }

  if (lineStrips.length !== 0) {
    const currentLineStripsColor = lineStrips[0].color;
    const currentLineStripsWidth = lineStrips[0].width;
    const currentPhonemeTimingLineColor = currentPhonemeTimingLineStyle.color;
    const currentPhonemeTimingLineWidth = currentPhonemeTimingLineStyle.width;

    if (
      !currentLineStripsColor.equals(currentPhonemeTimingLineColor) ||
      currentLineStripsWidth !== currentPhonemeTimingLineWidth
    ) {
      for (const lineStrip of lineStrips) {
        stage.removeChild(lineStrip.displayObject);
        lineStrip.destroy();
      }
      lineStrips = [];
    }
  }

  if (textsMap.size !== 0) {
    const texts = [...textsMap.values()][0];
    if (texts.length !== 0) {
      const currentTextFill = texts[0].style.fill;
      const currentPhonemeTextFill = currentTextStyle.fill;

      if (currentTextFill !== currentPhonemeTextFill) {
        for (const texts of textsMap.values()) {
          for (const text of texts) {
            const container = getOrThrow(textContainersMap, text);

            stage.removeChild(container);
            container.destroy(true);
          }
        }
        textsMap.clear();
        textContainersMap.clear();
        textMasksMap.clear();
      }
    }
  }

  const phonemeCount = phonemeInfos.length;
  const lineStripCount = lineStrips.length;

  if (lineStripCount < phonemeCount) {
    for (let i = 0; i < phonemeCount - lineStripCount; i++) {
      const newLineStrip = new LineStrip(
        2,
        currentPhonemeTimingLineStyle.color,
        currentPhonemeTimingLineStyle.width,
      );

      stage.addChild(newLineStrip.displayObject);
      lineStrips.push(newLineStrip);
    }
  }

  const needTextCountMap = new Map<string, number>();
  for (const phonemeInfo of phonemeInfos) {
    if (phonemeInfo.phoneme === "pau") {
      continue;
    }
    const currentCount = needTextCountMap.get(phonemeInfo.phoneme) ?? 0;

    needTextCountMap.set(phonemeInfo.phoneme, currentCount + 1);
  }
  for (const [phonemeStr, needTextCount] of needTextCountMap) {
    let texts = textsMap.get(phonemeStr);
    if (texts == undefined) {
      texts = [];
      textsMap.set(phonemeStr, texts);
    }

    const currentTextCount = texts.length;
    for (let i = 0; i < needTextCount - currentTextCount; i++) {
      const text = new PIXI.Text(phonemeStr, currentTextStyle);
      const container = new PIXI.Container();
      const mask = new PIXI.Graphics();

      container.mask = mask;
      container.addChild(text);
      stage.addChild(container);
      texts.push(text);
      textContainersMap.set(text, container);
      textMasksMap.set(text, mask);
    }
  }

  const phonemeStartXArray: number[] = [];
  for (const phonemeInfo of phonemeInfos) {
    const phonemeStartTicks = secondToTick(
      phonemeInfo.startTime,
      tempos.value,
      tpqn.value,
    );
    const phonemeStartBaseX = tickToBaseX(phonemeStartTicks, tpqn.value);
    const phonemeStartX = Math.round(
      phonemeStartBaseX * viewportInfo.scaleX - viewportInfo.offsetX,
    );
    phonemeStartXArray.push(phonemeStartX);
  }

  const unassignedTextsMap = new Map<string, PIXI.Text[]>();
  for (const [phonemeStr, texts] of textsMap) {
    unassignedTextsMap.set(phonemeStr, [...texts]);
  }

  for (let i = 0; i < phonemeInfos.length; i++) {
    const phonemeInfo = phonemeInfos[i];
    const phonemeStartX = phonemeStartXArray[i];
    const nextPhonemeStartX = getNext(phonemeStartXArray, i);

    const lineStrip = lineStrips[i];

    lineStrip.renderable = true;
    lineStrip.setPoint(0, phonemeStartX + 0.5, 0);
    lineStrip.setPoint(1, phonemeStartX + 0.5, viewportInfo.height);
    lineStrip.update();

    if (phonemeInfo.phoneme !== "pau") {
      const text = getOrThrow(unassignedTextsMap, phonemeInfo.phoneme).pop();
      if (text == undefined) {
        throw new UnreachableError("text is undefined.");
      }
      const textContainer = getOrThrow(textContainersMap, text);
      const textMask = getOrThrow(textMasksMap, text);

      textContainer.renderable = true;
      textContainer.x = phonemeStartX + 3;
      textContainer.y = 50;

      let maskWidth = 36;
      if (nextPhonemeStartX != undefined) {
        maskWidth = Math.min(maskWidth, nextPhonemeStartX - textContainer.x);
      }
      const maskHeight = 36;

      textMask
        .clear()
        .beginFill(0xffffff)
        .drawRect(textContainer.x, textContainer.y, maskWidth, maskHeight)
        .endFill();
    }
  }
  for (let i = phonemeInfos.length; i < lineStrips.length; i++) {
    const lineStrip = lineStrips[i];

    lineStrip.renderable = false;
  }
  for (const texts of unassignedTextsMap.values()) {
    for (const text of texts) {
      const textContainer = getOrThrow(textContainersMap, text);
      textContainer.renderable = false;
    }
  }

  renderer.render(stage);
};

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch([mounted, phraseInfosInSelectedTrack, tempos, tpqn], ([mounted]) => {
  if (mounted) {
    renderInNextFrame = true;
  }
});

watch(isDark, () => {
  renderInNextFrame = true;
});

watch(
  () => [store.state.sequencerZoomX, props.offsetX],
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

  // webGLVersionをチェックする
  // 2未満の場合、音素タイミングの表示ができないのでエラーとしてロギングする
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
  for (const lineStrip of lineStrips) {
    stage?.removeChild(lineStrip.displayObject);
    lineStrip.destroy();
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
  z-index: vars.$z-index-sing-phoneme-timing;
  pointer-events: none;
  position: relative;

  contain: strict; // canvasのサイズが変わるのを無視する
}
</style>
