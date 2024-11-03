import { colors, Dark, setCssVar } from "quasar";
import { EditorFontType, ThemeColorType, ThemeConf } from "@/type/preload";

/** テーマの設定をCSSへ反映する */
export function setThemeToCss(theme: ThemeConf) {
  for (const key in theme.colors) {
    const color = theme.colors[key as ThemeColorType];
    const { r, g, b } = colors.hexToRgb(color);
    document.documentElement.style.setProperty(`--color-${key}`, color);
    document.documentElement.style.setProperty(
      `--color-${key}-rgb`,
      `${r}, ${g}, ${b}`,
    );
  }
  const mixColors: ThemeColorType[][] = [
    ["primary", "background"],
    ["warning", "background"],
  ];
  for (const [color1, color2] of mixColors) {
    const color1Rgb = colors.hexToRgb(theme.colors[color1]);
    const color2Rgb = colors.hexToRgb(theme.colors[color2]);
    const r = Math.trunc((color1Rgb.r + color2Rgb.r) / 2);
    const g = Math.trunc((color1Rgb.g + color2Rgb.g) / 2);
    const b = Math.trunc((color1Rgb.b + color2Rgb.b) / 2);
    const propertyName = `--color-mix-${color1}-${color2}-rgb`;
    const cssColor = `${r}, ${g}, ${b}`;
    document.documentElement.style.setProperty(propertyName, cssColor);
  }
  Dark.set(theme.isDark);
  setCssVar("primary", theme.colors["primary"]);
  setCssVar("warning", theme.colors["warning"]);

  document.documentElement.setAttribute(
    "is-dark-theme",
    theme.isDark ? "true" : "false",
  );
}

/** フォントを設定する */
export function setFontToCss(font: EditorFontType) {
  document.body.setAttribute("data-editor-font", font);
}

let textWidthTempCanvas: HTMLCanvasElement | undefined;
let textWidthTempContext: CanvasRenderingContext2D | undefined;

export type FontSpecification = {
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
};
/**
 * 特定のフォントでの文字列の描画幅を取得する。
 * @see  https://stackoverflow.com/a/21015393
 */
export function predictTextWidth(text: string, font: FontSpecification) {
  if (!textWidthTempCanvas) {
    textWidthTempCanvas = document.createElement("canvas");
    textWidthTempContext = textWidthTempCanvas.getContext("2d") ?? undefined;
  }
  if (!textWidthTempContext) {
    throw new Error("Failed to get 2d context");
  }
  textWidthTempContext.font = `${font.fontWeight} ${font.fontSize}px ${font.fontFamily}`;
  const metrics = textWidthTempContext.measureText(text);
  return metrics.width;
}
