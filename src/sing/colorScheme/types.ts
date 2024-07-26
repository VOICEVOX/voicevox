// 型定義

// 内部で使用するOKLCHのL,C,H配列
export type OklchColorArray = [number, number, number]; // [light, Chroma, Hue]
// CSSカラー文字列
export type CSSColorString = string; // eg. "#000000" oklch(0.1 0.1 0) rgb(0 0 0) p3(0.1 0.1 0)...
// カラー名
export type ColorName = string; // eg. primary, onPrimary, neutral, outline, aliasColorName, customColorName...
// カラーのタイプ
export type ColorType =
  | "primary"
  | "secondary"
  | "tertiary"
  | "neutral"
  | "neutralVariant"
  | "error";
// カラースペース
export type ColorSpace = "oklch" | "hex" | "rgb" | "p3";

// パレット生成器
export type PaletteGenerator = (
  baseColor: OklchColorArray,
  type: ColorType,
) => Record<number, string>;

// カラーロール
export interface ColorRole {
  name: string;
  palette: ColorType;
  light: number;
  dark: number;
}

// カラースキーム設定(入力)
export interface ColorSchemeConfig {
  name: string;
  displayName: string;
  primary: string;
  secondary?: string;
  tertiary?: string;
  neutral?: string;
  neutralVariant?: string;
  error?: string;
  aliasColors?: AliasColorConfig[];
  customColors?: CustomColorConfig[];
}

// 特定のパレットから明度を取得するカラー
export interface AliasColorConfig {
  name: string;
  displayName: string;
  palette: ColorType; // primary, secondary...
  light: number;
  dark: number;
}

// カスタムカラー
export interface CustomColorConfig {
  name: string;
  displayName: string;
  sourceColor: CSSColorString;
  palette: ColorType;
}

// カラーパレット
export interface ColorPalette {
  name: ColorType;
  colors: Record<number, string>;
}

export interface ColorSet {
  light: string;
  dark: string;
}

// カラースキーム(出力)
export interface ColorScheme {
  name: string;
  displayName: string;
  palettes: Record<ColorType, ColorPalette>; // パレット
  roles: Record<ColorName, { light: string; dark: string }>; // カラーロール
  aliasColors: Record<ColorName, { light: string; dark: string }>; // カラー別名
  customColors: Record<ColorName, { light: string; dark: string }>; // カスタムカラー
  config: ColorSchemeConfig; // カラースキーム設定(入力)
}
