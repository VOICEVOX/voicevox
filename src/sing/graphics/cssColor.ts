import { Color } from "@/sing/graphics/lineStrip";
import { ensureNotNullish } from "@/type/utility";

// 色の解決ごとにcanvasを生成しないよう、1x1の描画コンテキストを使い回す。
let sharedContext: CanvasRenderingContext2D | undefined;

const getSharedContext = () => {
  if (sharedContext == undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    sharedContext = ensureNotNullish(
      canvas.getContext("2d", { willReadFrequently: true }),
      "Failed to get 2d context.",
    );
  }
  return sharedContext;
};

// 無効な色文字列を検出するための比較用マーカー色。
// 1色だけでは、無効値と、その色に正規化される有効値
// （例: rgb(1, 2, 3) → #010203）を区別できないため、2色で判定する。
const COLOR_VALIDATION_MARKERS = ["#010203", "#040506"] as const;

/**
 * CSS変数に定義された色をピクセル値として解決する。
 * PIXI.GraphicsはCSS変数を参照できないため、1x1のcanvasに描画して実際の色を読み取る。
 * これにより、oklch()などブラウザが解釈できる色表記をそのまま扱える。
 * CSS変数が未定義、または色として解釈できない場合は例外を投げる。
 */
export const resolveColorFromCssVariable = (
  element: HTMLElement,
  variableName: string,
): Color => {
  const value = window
    .getComputedStyle(element)
    .getPropertyValue(variableName)
    .trim();
  if (value === "") {
    throw new Error(`CSS variable is not defined: ${variableName}`);
  }

  const context = getSharedContext();
  // CSS変数の定義ミスを誤った描画として見逃さないよう、canvasが値を受理したか検証する。
  // canvasは無効な色文字列の代入を無視するため、無効値なら異なるマーカー色が残り、
  // 有効値なら両方が同じ正規化済みの色になる。
  const resolvedValues = COLOR_VALIDATION_MARKERS.map((marker) => {
    context.fillStyle = marker;
    context.fillStyle = value;
    return context.fillStyle;
  });
  if (resolvedValues[0] !== resolvedValues[1]) {
    throw new Error(`Invalid color value: ${value} (${variableName})`);
  }

  // 半透明色が前回の色に合成されないよう、ピクセルを透明に戻してから描画する。
  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const data = context.getImageData(0, 0, 1, 1).data;
  return new Color(data[0], data[1], data[2], data[3]);
};
