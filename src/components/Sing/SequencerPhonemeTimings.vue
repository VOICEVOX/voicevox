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
import { secondToTick } from "@/sing/music";
import { tickToBaseX } from "@/sing/viewHelper";
import { getNext, getPrev } from "@/sing/utility";
import { getOrThrow } from "@/helpers/mapHelper";
import { EditorFrameAudioQuery } from "@/store/type";
import { UnreachableError } from "@/type/utility";

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

const phonemeTimingLineStyles: {
  light: { color: number; alpha: number; width: number };
  dark: { color: number; alpha: number; width: number };
} = {
  light: {
    color: 0x8bc796,
    alpha: 1,
    width: 1,
  },
  dark: {
    color: 0x82b38b,
    alpha: 1,
    width: 1,
  },
};

const phonemeTextStyles: {
  light: PIXI.TextStyle;
  dark: PIXI.TextStyle;
} = {
  light: new PIXI.TextStyle({ fill: "#252E26", fontSize: 14 }),
  dark: new PIXI.TextStyle({ fill: "#ccc8c9", fontSize: 14 }),
};

const { mounted } = useMounted();

// DOM参照
const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

// リサイズ監視とCanvasサイズ
let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;

// PIXI関連の変数
let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;

// 線描画用のGraphicsプール
const graphics: PIXI.Graphics[] = [];
// 音素文字ごとのTextオブジェクトプール（キーは音素文字）
const textsMap = new Map<string, PIXI.Text[]>();
// Textを内包するContainer（マスク用）のマップ
const textContainersMap = new Map<PIXI.Text, PIXI.Container>();
// Textごとのマスク用Graphicsマップ
const textMasksMap = new Map<PIXI.Text, PIXI.Graphics>();

let lastIsDark: boolean | undefined;
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

  const temposValue = toRaw(tempos.value);

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

  // テーマ切り替え時の処理
  // スタイルが変わるため、既存のテキストオブジェクトを全て破棄する
  if (lastIsDark != undefined && lastIsDark !== isDark.value) {
    for (const texts of textsMap.values()) {
      for (const text of texts) {
        const container = textContainersMap.get(text);
        if (container != undefined) {
          stage.removeChild(container);
          container.destroy(true);
        }
      }
    }
    textsMap.clear();
    textContainersMap.clear();
    textMasksMap.clear();
  }
  lastIsDark = isDark.value;

  const phonemeInfos: PhonemeInfo[] = [];

  // 描画すべき音素の情報を収集（カリング処理含む）
  for (const phraseInfo of phraseInfosInSelectedTrack.value) {
    const rawPhraseInfo = toRaw(phraseInfo);
    const phraseQuery = rawPhraseInfo.query;
    if (phraseQuery == undefined) {
      continue;
    }

    // フレーズの開始・終了位置を計算
    const phraseStartTime = rawPhraseInfo.startTime;
    const phraseStartTicks = secondToTick(
      phraseStartTime,
      temposValue,
      tpqn.value,
    );
    const phraseStartX =
      tickToBaseX(phraseStartTicks, tpqn.value) * viewportInfo.scaleX -
      viewportInfo.offsetX;
    const phraseFrameLength = phraseQuery.phonemes.reduce(
      (acc, p) => acc + p.frameLength,
      0,
    );
    const phraseEndTime =
      phraseStartTime + phraseFrameLength / phraseQuery.frameRate;
    const phraseEndTicks = secondToTick(phraseEndTime, temposValue, tpqn.value);
    const phraseEndX =
      tickToBaseX(phraseEndTicks, tpqn.value) * viewportInfo.scaleX -
      viewportInfo.offsetX;

    // 画面の左外、または右外にある場合は描画対象外（カリング）
    if (phraseStartX > viewportInfo.width || phraseEndX < 0) {
      continue;
    }

    // フレーズ内の各音素について処理
    let phonemeStartFrame = 0;
    for (let i = 0; i < phraseQuery.phonemes.length; i++) {
      const phoneme = phraseQuery.phonemes[i];
      const prevPhoneme = getPrev(phraseQuery.phonemes, i);

      // 子音・母音とフレーズ最後のpauを描画対象とする
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

  // 線のGraphicsが足りなければ追加
  while (graphics.length < phonemeInfos.length) {
    const newGraphic = new PIXI.Graphics();
    stage.addChild(newGraphic);
    graphics.push(newGraphic);
  }

  // 必要なテキスト（音素文字ごと）の数をカウント
  const needTextCountMap = new Map<string, number>();
  for (const phonemeInfo of phonemeInfos) {
    if (phonemeInfo.phoneme === "pau") {
      continue;
    }
    const currentCount = needTextCountMap.get(phonemeInfo.phoneme) ?? 0;
    needTextCountMap.set(phonemeInfo.phoneme, currentCount + 1);
  }

  // テキストオブジェクトが足りなければ追加生成
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

      // マスクの設定（隣の音素にはみ出さないようにするため）
      container.mask = mask;
      container.addChild(text);
      stage.addChild(container);

      texts.push(text);
      textContainersMap.set(text, container);
      textMasksMap.set(text, mask);
    }
  }

  // 先に全てのX座標を計算しておく（次の音素のX座標を知る必要があるため）
  const phonemeStartXArray: number[] = [];
  for (const phonemeInfo of phonemeInfos) {
    const phonemeStartTicks = secondToTick(
      phonemeInfo.startTime,
      temposValue,
      tpqn.value,
    );
    const phonemeStartBaseX = tickToBaseX(phonemeStartTicks, tpqn.value);
    const phonemeStartX = Math.round(
      phonemeStartBaseX * viewportInfo.scaleX - viewportInfo.offsetX,
    );
    phonemeStartXArray.push(phonemeStartX);
  }

  // 割り当て用の一時マップ（プールから取り出す用）
  const unassignedTextsMap = new Map<string, PIXI.Text[]>();
  for (const [phonemeStr, texts] of textsMap) {
    unassignedTextsMap.set(phonemeStr, [...texts]);
  }

  // 更新
  for (let i = 0; i < phonemeInfos.length; i++) {
    const phonemeInfo = phonemeInfos[i];
    const phonemeStartX = phonemeStartXArray[i];
    const nextPhonemeStartX = getNext(phonemeStartXArray, i);

    // 線の更新
    const graphic = graphics[i];
    graphic.renderable = true;
    graphic.clear();
    graphic.lineStyle(
      currentPhonemeTimingLineStyle.width,
      currentPhonemeTimingLineStyle.color,
      currentPhonemeTimingLineStyle.alpha,
    );
    // 線をピクセルパーフェクトにするため0.5ずらす
    graphic.moveTo(phonemeStartX - 0.5, 0);
    graphic.lineTo(phonemeStartX - 0.5, viewportInfo.height);

    // テキストの更新
    if (phonemeInfo.phoneme !== "pau") {
      // プールから取得
      const text = getOrThrow(unassignedTextsMap, phonemeInfo.phoneme).pop();
      if (text == undefined) {
        throw new UnreachableError("text is undefined.");
      }
      const textContainer = getOrThrow(textContainersMap, text);
      const textMask = getOrThrow(textMasksMap, text);

      textContainer.renderable = true;
      textContainer.x = phonemeStartX + 3; // 線から少し右にずらす
      textContainer.y = 50; // Y座標は固定

      // マスク幅の計算（次の音素までの距離、または固定最大幅）
      let maskWidth = 36;
      if (nextPhonemeStartX != undefined) {
        maskWidth = Math.min(
          maskWidth,
          nextPhonemeStartX - textContainer.x - 1,
        );
      }
      const maskHeight = 36;

      // マスクの更新
      textMask
        .clear()
        .beginFill(0xffffff)
        .drawRect(textContainer.x, textContainer.y, maskWidth, maskHeight)
        .endFill();
    }
  }

  // 余ったGraphicsを非表示
  for (let i = phonemeInfos.length; i < graphics.length; i++) {
    graphics[i].renderable = false;
  }
  // 余ったTextContainerを非表示
  for (const texts of unassignedTextsMap.values()) {
    for (const text of texts) {
      const textContainer = getOrThrow(textContainersMap, text);
      textContainer.renderable = false;
    }
  }

  // 描画実行
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
  if (!canvasContainerElement || !canvasElement) {
    throw new Error("canvas elements are missing.");
  }

  canvasWidth = canvasContainerElement.clientWidth;
  canvasHeight = canvasContainerElement.clientHeight;

  // PIXI Rendererの初期化
  renderer = new PIXI.Renderer({
    view: canvasElement,
    backgroundAlpha: 0, // 背景透過
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    width: canvasWidth,
    height: canvasHeight,
  });
  stage = new PIXI.Container();

  // アニメーションループ（requestAnimationFrame）
  const callback = () => {
    if (renderInNextFrame) {
      render();
      renderInNextFrame = false;
    }
    requestId = window.requestAnimationFrame(callback);
  };
  requestId = window.requestAnimationFrame(callback);

  // リサイズ監視
  resizeObserver = new ResizeObserver(() => {
    if (renderer == undefined) return;

    const newWidth = canvasContainerElement.clientWidth;
    const newHeight = canvasContainerElement.clientHeight;

    if (newWidth > 0 && newHeight > 0) {
      canvasWidth = newWidth;
      canvasHeight = newHeight;
      renderer.resize(canvasWidth, canvasHeight);
      renderInNextFrame = true;
    }
  });
  resizeObserver.observe(canvasContainerElement);
});

onUnmounted(() => {
  // アニメーションループの停止
  if (requestId != undefined) {
    window.cancelAnimationFrame(requestId);
  }

  // PIXIオブジェクトのクリーンアップ
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
@use "@/styles/v2/variables" as vars;

.canvas-container {
  overflow: hidden;
  pointer-events: none;
  position: relative;

  contain: strict; // ブラウザへの最適化ヒント（レイアウト計算の分離）
}
</style>
