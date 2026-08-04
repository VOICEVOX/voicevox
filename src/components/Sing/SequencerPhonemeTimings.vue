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
import { tickToBaseX, type ViewportInfo } from "@/sing/viewHelper";
import { clamp, getNext } from "@/sing/utility";
import { getOrThrow } from "@/helpers/mapHelper";
import { UnreachableError, assertNonNullable } from "@/type/utility";
import type {
  PhonemeTimingPreview,
  PhonemeTimingInfo,
} from "@/sing/phonemeTimingEditorStateMachine/common";

type PhonemeDisplayState = "default" | "edited" | "movePreview";

type PhonemeDisplayInfo = {
  readonly phoneme: string;
  readonly displayState: PhonemeDisplayState;
  startTime: number;
};

const props = defineProps<{
  viewportInfo: ViewportInfo;
  previewPhonemeTiming?: PhonemeTimingPreview;
  phonemeTimingInfos: PhonemeTimingInfo[];
  phonemeTextY: number;
}>();

const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const isDark = computed(() => store.state.currentTheme === "Dark");
const tempos = computed(() => store.state.tempos);
const previewPhonemeTiming = computed(() => props.previewPhonemeTiming);
const phonemeTimingInfos = computed(() => props.phonemeTimingInfos);
const editorFrameRate = computed(() => store.state.editorFrameRate);

type PhonemeTimingLineStyle = { color: number; alpha: number; width: number };
const phonemeTimingLineStyles: Record<
  "light" | "dark",
  Record<PhonemeDisplayState, PhonemeTimingLineStyle>
> = {
  light: {
    default: { color: 0x8bc796, alpha: 1, width: 1 },
    edited: { color: 0x00a73f, alpha: 1, width: 2 },
    movePreview: { color: 0x3d7eff, alpha: 1, width: 2 },
  },
  dark: {
    default: { color: 0x547359, alpha: 1, width: 1 },
    edited: { color: 0x28a652, alpha: 1, width: 2 },
    movePreview: { color: 0x699ff0, alpha: 1, width: 2 },
  },
};

const phonemeTextStyleSpecs: {
  light: { fill: string };
  dark: { fill: string };
} = {
  light: { fill: "#252E26" },
  dark: { fill: "#ccc8c9" },
};
let phonemeTextStyles:
  | { light: PIXI.TextStyle; dark: PIXI.TextStyle }
  | undefined;

const { mounted } = useMounted();

const canvasContainer = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

let resizeObserver: ResizeObserver | undefined;
let canvasWidth: number | undefined;
let canvasHeight: number | undefined;

// TODO: pixi.js関連の変数をまとめてモジュール化し、isUnmountedなどのフラグを無くす
let isUnmounted = false;
let renderer: PIXI.Renderer | undefined;
let stage: PIXI.Container | undefined;

// 線描画用のGraphicsプール
const graphics: PIXI.Graphics[] = [];
// 音素文字をキーとしたTextオブジェクトのプール
const textsMap = new Map<string, PIXI.Text[]>();
// Textにマスクを適用するためのContainerのマップ
const textContainersMap = new Map<PIXI.Text, PIXI.Container>();
// Textごとのマスク用Graphicsマップ
const textMasksMap = new Map<PIXI.Text, PIXI.Graphics>();

let lastIsDark: boolean | undefined;
let requestId: number | undefined;
let renderInNextFrame = false;

const render = () => {
  assertNonNullable(renderer);
  assertNonNullable(stage);
  assertNonNullable(canvasWidth);
  assertNonNullable(canvasHeight);
  assertNonNullable(phonemeTextStyles);

  const rawTempos = toRaw(tempos.value);
  const rawPhonemeTimingInfos = toRaw(phonemeTimingInfos.value);
  const preview = previewPhonemeTiming.value;
  const viewportInfo = props.viewportInfo;
  const editorFrameRateValue = editorFrameRate.value;
  const oneFrameSeconds = 1 / editorFrameRateValue;

  const currentTextStyle = isDark.value
    ? phonemeTextStyles.dark
    : phonemeTextStyles.light;

  // テーマが変わるとテキストスタイルも変わるため、既存のテキストオブジェクトを全て破棄する
  if (lastIsDark != undefined && lastIsDark !== isDark.value) {
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
  lastIsDark = isDark.value;

  // 描画用の情報を生成
  const phonemeDisplayInfos: PhonemeDisplayInfo[] = [];
  for (const phonemeTimingInfo of rawPhonemeTimingInfos) {
    // 先頭のpauなどnoteIdが無い音素は描画しない
    if (phonemeTimingInfo.noteId == undefined) {
      continue;
    }

    const isMovePreview =
      preview?.type === "move" &&
      preview.noteId === phonemeTimingInfo.noteId &&
      preview.phonemeIndexInNote === phonemeTimingInfo.phonemeIndexInNote;
    const isErasePreview =
      preview?.type === "erase" &&
      preview.targets.some(
        (target) =>
          target.noteId === phonemeTimingInfo.noteId &&
          target.phonemeIndexInNote === phonemeTimingInfo.phonemeIndexInNote,
      );

    // 削除プレビュー中は元の位置、移動プレビュー中は元の位置にオフセットを加えた位置、それ以外は編集後の位置を使う
    let startTime: number;
    if (isErasePreview) {
      startTime = phonemeTimingInfo.originalStartTimeSeconds;
    } else if (isMovePreview) {
      startTime =
        phonemeTimingInfo.originalStartTimeSeconds + preview.offsetSeconds;
    } else {
      startTime = phonemeTimingInfo.editedStartTimeSeconds;
    }

    let displayState: PhonemeDisplayState = "default";
    if (isMovePreview) {
      displayState = "movePreview";
    } else if (phonemeTimingInfo.isEdited && !isErasePreview) {
      displayState = "edited";
    }

    phonemeDisplayInfos.push({
      phoneme: phonemeTimingInfo.phoneme,
      displayState,
      startTime,
    });
  }

  // 音素の順序入れ替わり防止
  // プレビュー等で音素の位置が変わると前後の音素と順序が入れ替わる可能性があるため、
  // 表示上は前後の音素との順序を維持するよう制限する
  for (let i = phonemeDisplayInfos.length - 1; i >= 0; i--) {
    const phonemeDisplayInfo = phonemeDisplayInfos[i];
    const nextPhonemeDisplayInfo = getNext(phonemeDisplayInfos, i);
    if (nextPhonemeDisplayInfo != undefined) {
      const maxStartTime = nextPhonemeDisplayInfo.startTime - oneFrameSeconds;
      if (phonemeDisplayInfo.startTime > maxStartTime) {
        phonemeDisplayInfo.startTime = maxStartTime;
      }
    }
  }

  // 画面外の音素を除外する
  const cullingMargin = 40;
  const culledPhonemeDisplayInfos: PhonemeDisplayInfo[] = [];
  for (const phonemeDisplayInfo of phonemeDisplayInfos) {
    const phonemeStartTicks = secondToTick(
      phonemeDisplayInfo.startTime,
      rawTempos,
      tpqn.value,
    );
    const phonemeStartBaseX = tickToBaseX(phonemeStartTicks, tpqn.value);
    const phonemeStartX = Math.round(
      phonemeStartBaseX * viewportInfo.scaleX - viewportInfo.offsetX,
    );
    if (
      phonemeStartX >= -cullingMargin &&
      phonemeStartX <= canvasWidth + cullingMargin
    ) {
      culledPhonemeDisplayInfos.push(phonemeDisplayInfo);
    }
  }

  // 線のGraphicsが足りなければ追加
  while (graphics.length < culledPhonemeDisplayInfos.length) {
    const newGraphic = new PIXI.Graphics();
    stage.addChild(newGraphic);
    graphics.push(newGraphic);
  }

  // 音素文字ごとに必要なテキスト数をカウント
  const needTextCountMap = new Map<string, number>();
  for (const phonemeDisplayInfo of culledPhonemeDisplayInfos) {
    if (phonemeDisplayInfo.phoneme === "pau") {
      continue;
    }
    const currentCount = needTextCountMap.get(phonemeDisplayInfo.phoneme) ?? 0;
    needTextCountMap.set(phonemeDisplayInfo.phoneme, currentCount + 1);
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
      const text = new PIXI.Text({ text: phonemeStr, style: currentTextStyle });
      const container = new PIXI.Container();
      const mask = new PIXI.Graphics();

      // 隣の音素にはみ出さないようにマスクを設定する
      container.mask = mask;
      container.addChild(text);
      container.addChild(mask);
      stage.addChild(container);

      texts.push(text);
      textContainersMap.set(text, container);
      textMasksMap.set(text, mask);
    }
  }

  // マスク幅の計算で次の音素のX座標が必要になるため、先に全てのX座標を計算しておく
  const phonemeStartXArray: number[] = [];
  for (const phonemeDisplayInfo of culledPhonemeDisplayInfos) {
    const phonemeStartTicks = secondToTick(
      phonemeDisplayInfo.startTime,
      rawTempos,
      tpqn.value,
    );
    const phonemeStartBaseX = tickToBaseX(phonemeStartTicks, tpqn.value);
    const phonemeStartX = Math.round(
      phonemeStartBaseX * viewportInfo.scaleX - viewportInfo.offsetX,
    );
    phonemeStartXArray.push(phonemeStartX);
  }

  // 未割り当てのTextを管理するため、プールをコピーした一時マップを作る
  const unassignedTextsMap = new Map<string, PIXI.Text[]>();
  for (const [phonemeStr, texts] of textsMap) {
    unassignedTextsMap.set(phonemeStr, [...texts]);
  }

  // 線とテキストを更新
  for (let i = 0; i < culledPhonemeDisplayInfos.length; i++) {
    const phonemeDisplayInfo = culledPhonemeDisplayInfos[i];
    const phonemeStartX = phonemeStartXArray[i];
    const nextPhonemeStartX = getNext(phonemeStartXArray, i);

    // 線の更新
    const graphic = graphics[i];
    graphic.renderable = true;
    graphic.clear();

    const themeStyles = isDark.value
      ? phonemeTimingLineStyles.dark
      : phonemeTimingLineStyles.light;
    const lineStyle = themeStyles[phonemeDisplayInfo.displayState];

    const lineX =
      lineStyle.width % 2 === 1 ? phonemeStartX - 0.5 : phonemeStartX;
    graphic.moveTo(lineX, 0).lineTo(lineX, canvasHeight).stroke({
      width: lineStyle.width,
      color: lineStyle.color,
      alpha: lineStyle.alpha,
    });

    // テキストの更新
    if (phonemeDisplayInfo.phoneme !== "pau") {
      // プールから取得
      const text = getOrThrow(
        unassignedTextsMap,
        phonemeDisplayInfo.phoneme,
      ).pop();
      if (text == undefined) {
        throw new UnreachableError("text is undefined.");
      }
      const textContainer = getOrThrow(textContainersMap, text);
      const textMask = getOrThrow(textMasksMap, text);

      textContainer.renderable = true;
      textContainer.x = phonemeStartX + 3; // 線から少し右にずらす
      textContainer.y = props.phonemeTextY;

      // マスク幅の計算
      let maskWidth = 36;
      if (nextPhonemeStartX != undefined) {
        maskWidth = clamp(
          nextPhonemeStartX - textContainer.x - 1,
          0,
          maskWidth,
        );
      }
      const maskHeight = 36;

      // マスクの更新
      textMask
        .clear()
        .rect(0, 0, maskWidth, maskHeight)
        .fill({ color: 0xffffff });
    }
  }

  // 余ったGraphicsを非表示
  for (let i = culledPhonemeDisplayInfos.length; i < graphics.length; i++) {
    graphics[i].renderable = false;
  }
  // 余ったTextContainerを非表示
  for (const texts of unassignedTextsMap.values()) {
    for (const text of texts) {
      const textContainer = getOrThrow(textContainersMap, text);
      textContainer.renderable = false;
    }
  }

  renderer.render(stage);
};

// NOTE: mountedをwatchしているので、onMountedの直後に必ず１回実行される
watch(
  [
    mounted,
    phonemeTimingInfos,
    previewPhonemeTiming,
    tempos,
    tpqn,
    editorFrameRate,
    isDark,
    () => props.viewportInfo.scaleX,
    () => props.viewportInfo.offsetX,
  ],
  ([mounted]) => {
    if (mounted) {
      renderInNextFrame = true;
    }
  },
);

onMounted(async () => {
  const canvasContainerElement = canvasContainer.value;
  const canvasElement = canvas.value;
  assertNonNullable(canvasContainerElement);
  assertNonNullable(canvasElement);

  canvasWidth = canvasContainerElement.clientWidth;
  canvasHeight = canvasContainerElement.clientHeight;

  // アプリのフォントをPIXIのテキストスタイルに反映する
  // NOTE: フォントの変更に対応していないが、基本的にフォントが変更されることは少ないので、
  // 複雑性を下げるためにも対応しない
  const fontFamily = window.getComputedStyle(canvasContainerElement).fontFamily;
  phonemeTextStyles = {
    light: new PIXI.TextStyle({
      ...phonemeTextStyleSpecs.light,
      fontFamily,
      fontSize: 14,
    }),
    dark: new PIXI.TextStyle({
      ...phonemeTextStyleSpecs.dark,
      fontFamily,
      fontSize: 14,
    }),
  };

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
    assertNonNullable(renderer);

    const newWidth = canvasContainerElement.clientWidth;
    const newHeight = canvasContainerElement.clientHeight;

    if (newWidth > 0 && newHeight > 0) {
      canvasWidth = newWidth;
      canvasHeight = newHeight;
      renderer.resize(canvasWidth, canvasHeight);
      // 次フレームに描画を持ち越すとリサイズ直後の空canvasが一瞬表示されて点滅するため、
      // ペイント前のResizeObserverコールバック内で同期的に描画する
      renderInNextFrame = false;
      render();
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
  for (const texts of textsMap.values()) {
    for (const text of texts) {
      const container = getOrThrow(textContainersMap, text);
      stage?.removeChild(container);
      container.destroy(true);
    }
  }
  textsMap.clear();
  textContainersMap.clear();
  textMasksMap.clear();
  stage?.destroy(true);
  renderer?.destroy({ removeView: true });
  resizeObserver?.disconnect();
});
</script>

<style scoped lang="scss">
.canvas-container {
  overflow: hidden;
  pointer-events: none;
  position: relative;

  contain: strict; // canvasのサイズが変わるのを無視する
}
</style>
