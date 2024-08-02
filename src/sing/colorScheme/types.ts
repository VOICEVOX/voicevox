// OKLCH色空間の色情報(0-1) [l, c, h]
// 内部的に利用
export type OklchColor = readonly [number, number, number];

// CSSカラー文字列 (例: #000000, oklch(0.12 0.03 40), rgb(0, 0, 0))
export type CSSColorString = string;

// 色の役割 (Material Design 3互換 + カスタム)
export type ColorRole =
  | "primary"
  | "secondary"
  | "tertiary"
  | "neutral"
  | "neutralVariant"
  | "error"
  | string; // カスタムロール用

// ライトモードとダークモードの色情報
export interface ColorShades {
  lightShade: OklchColor;
  darkShade: OklchColor;
}

// カラーパレット（明度ごとの色情報）
export interface ColorPalette {
  name: ColorRole | string;
  shades: Record<number, OklchColor>;
}

// エイリアスカラー設定(特定の役割に対応するカラーを明度で指定)
export interface AliasColorConfig {
  name: string;
  displayName: string;
  role: ColorRole;
  lightShade: number;
  darkShade: number;
}

// カスタムカラー設定
export interface CustomColorConfig {
  name: string;
  displayName: string;
  sourceColor: CSSColorString;
  asRole?: boolean;
}

// カラースキーム設定
export interface ColorSchemeConfig {
  name: string;
  displayName: string;
  roleColors: Partial<Record<ColorRole, CSSColorString>>;
  customColors?: CustomColorConfig[];
  aliasColors?: AliasColorConfig[];
  algorithmName?: string;
}

// カラースキーム
export interface ColorScheme {
  name: string;
  displayName: string;
  roles: Record<ColorRole | string, ColorShades>;
  palettes: Record<ColorRole | string, ColorPalette>;
  config: ColorSchemeConfig;
}

// カラー生成アルゴリズム
export type ColorAlgorithm = (
  config: ColorSchemeConfig,
  sourceColor: OklchColor,
  targetRole: ColorRole | string,
  shade: number,
) => OklchColor;
