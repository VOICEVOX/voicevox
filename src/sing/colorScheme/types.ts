// OKLCH色空間の色情報(0-1) [l, c, h]
export type OklchColor = readonly [number, number, number];

// CSSカラー文字列 eg. #000000, oklch(0.12 0.03 40), rgb(0, 0, 0)
export type CSSColorString = string;

// カラーごとの役割(M3互換)
export type ColorRole =
  | "primary"
  | "secondary"
  | "tertiary"
  | "neutral"
  | "neutralVariant"
  | "error"
  | "custom";

// カラー生成アルゴリズム
export type ColorAlgorithm = (
  config: ColorSchemeConfig,
  targetRole: ColorRole,
  shade: number,
) => OklchColor;

// カラースキーム設定
export interface ColorSchemeConfig {
  name: string;
  displayName: string;
  baseColors: Partial<Record<ColorRole, CSSColorString>>;
  aliasColors?: AliasColorConfig[];
  customColors?: CustomColorConfig[];
}

// 特定のロールから明度を取得するカラー
export interface AliasColorConfig {
  name: string;
  displayName: string;
  role: ColorRole;
  lightShade: number;
  darkShade: number;
}

// 追加カラー
export interface CustomColorConfig {
  name: string;
  displayName: string;
  color: CSSColorString;
  role: ColorRole;
}

// カラーパレット
export interface ColorPalette {
  name: ColorRole | string;
  shades: Record<number, string>;
}

// 出力・保持するカラースキーム
export interface ColorScheme {
  name: string;
  displayName: string;
  palettes: Record<ColorRole | string, ColorPalette>;
  roles: Record<ColorRole | string, { light: OklchColor; dark: OklchColor }>;
  config: ColorSchemeConfig;
}
