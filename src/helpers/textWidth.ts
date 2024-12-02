/**
 * 文字列の描画幅を予測するための関数。
 */
import { z } from "zod";

let textWidthTempCanvas: HTMLCanvasElement | undefined;
let textWidthTempContext: CanvasRenderingContext2D | undefined;

const textWidthCacheKeySchema = z.string().brand("TextWidthCacheKey");
type TextWidthCacheKey = z.infer<typeof textWidthCacheKeySchema>;

export type FontSpecification = {
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
};
const getTextWidthCacheKey = (text: string, font: FontSpecification) =>
  textWidthCacheKeySchema.parse(
    `${text}-${font.fontFamily}-${font.fontWeight}-${font.fontSize}`,
  );

const textWidthCache = new Map<TextWidthCacheKey, number>();
/**
 * 特定のフォントでの文字列の描画幅を取得する。
 * @see  https://stackoverflow.com/a/21015393
 */
export function predictTextWidth(text: string, font: FontSpecification) {
  const key = getTextWidthCacheKey(text, font);
  const maybeCached = textWidthCache.get(key);
  if (maybeCached != undefined) {
    return maybeCached;
  }
  if (!textWidthTempCanvas) {
    textWidthTempCanvas = document.createElement("canvas");
    textWidthTempContext = textWidthTempCanvas.getContext("2d") ?? undefined;
  }
  if (!textWidthTempContext) {
    throw new Error("Failed to get 2d context");
  }
  textWidthTempContext.font = `${font.fontWeight} ${font.fontSize}px ${font.fontFamily}`;
  const metrics = textWidthTempContext.measureText(text);
  textWidthCache.set(key, metrics.width);
  return metrics.width;
}
