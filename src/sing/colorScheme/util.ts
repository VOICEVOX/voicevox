import Color from "colorjs.io";
import { OklchColor, CSSColorString } from "@/sing/colorScheme/types";

/**
 * 有効なCSSカラー文字列かどうかをチェックします。
 * @param colorString チェックする文字列
 * @returns 有効なCSSカラー文字列であればtrue / 不正であればfalse
 */
const isValidCssColorString = (colorString: string): boolean => {
  try {
    new Color(colorString);
    return true;
  } catch {
    return false;
  }
};

/**
 * 有効なOKLCH配列かどうかをチェック
 * @param oklchColor チェックするOKLCH配列
 * @returns 有効なOKLCH配列であればtrue / 不正であればfalse
 */
const isValidOklchColor = (oklchColor: OklchColor): boolean => {
  return oklchColor.every((value) => typeof value === "number");
};

/**
 * CSSカラー文字列をOKLCH配列に変換
 * @param colorString CSSカラー文字列
 * @returns OKLCH配列 [l, c, h]
 * @throws {Error} 無効なCSSカラー文字列の場合
 */
export const cssStringToOklch = (colorString: CSSColorString): OklchColor => {
  if (!isValidCssColorString(colorString)) {
    throw new Error(`Invalid CSS color string: ${colorString}`);
  }
  const color = new Color(colorString).to("oklch");
  return [color.l, color.c, color.h];
};

/**
 * OKLCH配列をCSS文字列に変換
 * @param oklchColor : OklchColor - OKLCH配列 [l, c, h]
 * @param format : string : "oklch" | "hex" | "rgb" | "p3" - 出力形式
 * @returns CSSカラー文字列
 * @throws {Error} 無効なOKLCH配列の場合
 */
export const oklchToCssString = (
  oklchColor: OklchColor,
  format: "oklch" | "hex" | "rgb" | "p3" = "oklch",
): CSSColorString => {
  const newL = Number(oklchColor[0]);
  const newC = Number(oklchColor[1]);
  const newH = Number(oklchColor[2]);
  const newOklchColor = [newL, newC, newH] as OklchColor;
  const color = new Color("oklch", [...newOklchColor]);
  return color.to(format === "oklch" ? "oklch" : "srgb").toString({ format });
};

/**
 * HEX形式のカラー文字列をOKLCH配列に変換
 * @param hexColor : string - HEX形式のカラー文字列 eg: "#FFF"
 * @returns OklchColor - OKLCH配列 [l, c, h]
 * @throws {Error} 無効なHEX文字列の場合
 */
export const hexToOklch = (hexColor: string): OklchColor => {
  if (!/^#([0-9A-Fa-f]{3}){1,2}$/.test(hexColor)) {
    throw new Error(`Invalid HEX color string: hexToOklch: ${hexColor}`);
  }
  return cssStringToOklch(hexColor);
};

/**
 * OKLCH配列をHEX形式のカラー文字列に変換
 * @param oklchColor OKLCH配列 [l, c, h]
 * @returns HEX形式のカラー文字列
 * @throws {Error} 無効なOKLCH配列の場合
 */
export const oklchToHex = (oklchColor: OklchColor): string => {
  if (!isValidOklchColor(oklchColor)) {
    throw new Error(`Invalid OKLCH color: oklchToHex: ${oklchColor}`);
  }
  return oklchToCssString(oklchColor, "hex");
};

/**
 * HEXカラー文字列をCSSカラー文字列に変換
 * @param hexColor HEXカラー文字列
 * @param format 出力形式 ("oklch" | "hex" | "rgb" | "p3")
 * @returns CSSカラー文字列
 */
export const hexToCssString = (
  hexColor: string,
  format: "oklch" | "hex" | "rgb" | "p3" = "oklch",
): CSSColorString => {
  const cssStr = new Color(hexColor).toString({ format });
  return cssStr;
};

export const cssStringToHex = (cssColorString: CSSColorString): string => {
  const color = new Color(cssColorString);
  return color.to("srgb").toString({ format: "hex" }) as string;
};

/**
 * 色の明度を調整
 * @param color 調整する色（OKLCH配列）
 * @param amount 調整量（-1.0 から 1.0）
 * @returns 調整後の色（OKLCH配列）
 * @throws {Error} 無効なOKLCH配列または調整量の場合
 */
export const adjustLightness = (
  color: OklchColor,
  amount: number,
): OklchColor => {
  if (!isValidOklchColor(color)) {
    throw new Error(`Invalid OKLCH color: adjustLightness: ${color}`);
  }
  if (amount < -1 || amount > 1) {
    throw new Error(
      `Invalid adjustment amount: adjustLightness: ${amount}. Must be between -1 and 1.`,
    );
  }
  const [l, c, h] = color;
  return [Math.max(0, Math.min(1, l + amount)), c, h];
};

/**
 * 色の彩度を調整
 * @param color 調整する色（OKLCH配列）
 * @param amount 調整量（-1.0 から 1.0）
 * @returns 調整後の色（OKLCH配列）
 * @throws {Error} 無効なOKLCH配列または調整量の場合
 */
export const adjustChroma = (color: OklchColor, amount: number): OklchColor => {
  if (!isValidOklchColor(color)) {
    throw new Error(`Invalid OKLCH color: ${color}`);
  }
  if (amount < -1 || amount > 1) {
    throw new Error(
      `Invalid adjustment amount: adjustChroma: ${amount}. Must be between -1 and 1.`,
    );
  }
  const [l, c, h] = color;
  return [l, Math.max(0, c + amount), h];
};

/**
 * 色の色相を調整
 * @param color 調整する色（OKLCH配列）
 * @param amount 調整量（度数）
 * @returns 調整後の色（OKLCH配列）
 * @throws {Error} 無効なOKLCH配列の場合
 */
export const adjustHue = (color: OklchColor, amount: number): OklchColor => {
  if (!isValidOklchColor(color)) {
    throw new Error(`Invalid OKLCH color: adjustHue: ${color}`);
  }
  const [l, c, h] = color;
  return [l, c, (h + amount + 360) % 360];
};
