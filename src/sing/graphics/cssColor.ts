import { Color } from "@/sing/graphics/lineStrip";
import { ensureNotNullish } from "@/type/utility";

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

const COLOR_VALIDATION_MARKER = "#010203";

/**
 * CSS変数に定義された色をピクセル値として解決する。
 * PIXI.GraphicsはCSS変数を参照できないため、1x1のcanvasに描画して実際の色を読み取る。
 * oklch()などCSSが解釈できる表記をそのまま扱える。
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
  // 無効な色文字列はfillStyleに代入しても無視され、直前の値が残る。
  // 先に比較用の色を設定し、値が変わらなければ無効と判定する。
  context.fillStyle = COLOR_VALIDATION_MARKER;
  context.fillStyle = value;
  if (
    context.fillStyle === COLOR_VALIDATION_MARKER &&
    value !== COLOR_VALIDATION_MARKER
  ) {
    throw new Error(`Invalid color value: ${value} (${variableName})`);
  }
  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const data = context.getImageData(0, 0, 1, 1).data;
  return new Color(data[0], data[1], data[2], data[3]);
};
