import Color from "colorjs.io";
import { CSSColorString } from "./types";

/**
 * カラーのコントラスト比を計算する
 * @param color1str カラー1の文字列
 * @param color2str カラー2の文字列
 * @param format コントラスト比の形式
 * @returns コントラスト比
 */
export const getContrastRatio = (
  color1str: CSSColorString,
  color2str: CSSColorString,
  format: "WCAG21" | "APCA" = "APCA",
) => {
  const color1 = new Color(color1str);
  const color2 = new Color(color2str);
  return color1.contrast(color2, format);
};

/**
 * コントラスト比のレベルを取得する
 * @param contrast コントラスト比
 * @param requiredContrast 必要なコントラスト比
 * @returns コントラスト比のレベル
 */
export const getContrastLevel = (
  contrast: number,
  requiredContrast: number,
): string => {
  if (contrast >= requiredContrast) return "Pass";
  return "Fail";
};
