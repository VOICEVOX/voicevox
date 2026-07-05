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

// 無効な色指定を検出するための番兵色
const SENTINEL_COLOR = "#010203";

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
  context.fillStyle = SENTINEL_COLOR;
  context.fillStyle = value;
  if (context.fillStyle === SENTINEL_COLOR && value !== SENTINEL_COLOR) {
    throw new Error(`Invalid color value: ${value} (${variableName})`);
  }
  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const data = context.getImageData(0, 0, 1, 1).data;
  return new Color(data[0], data[1], data[2], data[3]);
};
