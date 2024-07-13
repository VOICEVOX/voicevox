import {
  argbFromHex,
  Hct,
  DynamicScheme,
  SchemeContent,
  SchemeTonalSpot,
  SchemeNeutral,
  SchemeVibrant,
  SchemeExpressive,
  SchemeFidelity,
  SchemeMonochrome,
  SchemeRainbow,
  SchemeFruitSalad,
  TonalPalette,
  MaterialDynamicColors,
} from "@material/material-color-utilities";

// カラースキーマの種類
export type SchemeVariant =
  | "content"
  | "tonalSpot"
  | "neutral"
  | "vibrant"
  | "expressive"
  | "fidelity"
  | "monochrome"
  | "rainbow"
  | "fruitSalad";

// カラーパレットのキー(M3準拠)
export type PaletteKey =
  | "primary"
  | "secondary"
  | "tertiary"
  | "neutral"
  | "neutralVariant"
  | "error";

// カラー調整
export interface ColorAdjustment {
  hue?: number;
  chroma?: number;
  tone?: number;
}

// テーマオプション
export interface ThemeOptions {
  sourceColor: string;
  variant?: SchemeVariant;
  isDark?: boolean;
  contrastLevel?: number;
  adjustments?: Partial<Record<PaletteKey, ColorAdjustment>>;
}

// 定義済みカスタムカラー
export interface CustomDefinedColor {
  name: string;
  value: string;
  blend: boolean;
}

// パレットから取得するカスタムカラー
export interface CustomPaletteColor {
  name: string;
  palette: string;
  lightTone: number;
  darkTone: number;
  blend: boolean;
}

// カラーパレットオプション
export interface TonalPaletteOptions {
  color: string;
  tonalOffset?: number;
}

// カラースキーマのコンストラクタ
const SCHEME_CONSTRUCTORS: Record<SchemeVariant, typeof SchemeContent> = {
  content: SchemeContent,
  tonalSpot: SchemeTonalSpot,
  neutral: SchemeNeutral,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  fidelity: SchemeFidelity,
  monochrome: SchemeMonochrome,
  rainbow: SchemeRainbow,
  fruitSalad: SchemeFruitSalad,
};

// カラーパレットのキー
const PALETTE_KEYS: PaletteKey[] = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
  "error",
];

// カラーパレットのトーン比率
export const TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];

// ARGBをRGBAに変換
export const rgbaFromArgb = (argb: number, alpha: number = 1): string => {
  const r = (argb >> 16) & 255;
  const g = (argb >> 8) & 255;
  const b = argb & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
};

// テーマパレットの調整
export const adjustPalette = (
  palette: TonalPalette,
  adjustment: ColorAdjustment,
): TonalPalette => {
  const hue = adjustment.hue ?? palette.hue;
  const chroma = adjustment.chroma ?? palette.chroma;
  const tone = adjustment.tone ?? 50;
  return TonalPalette.fromHueAndChroma(
    Hct.from(hue, chroma, tone).hue,
    Hct.from(hue, chroma, tone).chroma,
  );
};

// M3準拠のダイナミックスキーマの生成
export const createDynamicScheme = (options: ThemeOptions): DynamicScheme => {
  const {
    sourceColor,
    variant = "tonalSpot",
    isDark = false,
    contrastLevel = 0,
    adjustments,
  } = options;
  const sourceColorHct = Hct.fromInt(argbFromHex(sourceColor));
  const SchemeConstructor = SCHEME_CONSTRUCTORS[variant];
  let scheme = new SchemeConstructor(sourceColorHct, isDark, contrastLevel);

  if (adjustments) {
    const adjustedPalettes = Object.entries(adjustments).reduce(
      (acc, [key, adjustment]) => {
        if (adjustment) {
          acc[`${key}Palette`] = adjustPalette(
            scheme[`${key}Palette` as keyof DynamicScheme] as TonalPalette,
            adjustment,
          );
        }
        return acc;
      },
      {} as Partial<Record<string, TonalPalette>>,
    );

    scheme = Object.create(Object.getPrototypeOf(scheme), {
      ...Object.getOwnPropertyDescriptors(scheme),
      ...Object.fromEntries(
        Object.entries(adjustedPalettes).map(([key, value]) => [
          key,
          { value, writable: false },
        ]),
      ),
    });
  }

  return scheme;
};

// テーマの色スキーマ
export interface ColorTheme {
  scheme: DynamicScheme;
  systemColors: Record<string, string>;
  paletteTones: Record<string, Record<number, string>>;
  customPaletteColors: Record<string, string>;
  customDefinedColors: Record<string, string>;
}

// テーマの色スキーマの生成
export const generateColorTheme = (
  options: ThemeOptions,
  customPaletteColors: CustomPaletteColor[] = [],
  customDefinedColors: CustomDefinedColor[] = [],
): ColorTheme => {
  const scheme = createDynamicScheme(options);

  // システムカラーの生成
  const systemColors = Object.entries(MaterialDynamicColors).reduce(
    (acc, [name, color]) => {
      if (typeof color === "object" && "getArgb" in color) {
        acc[name] = rgbaFromArgb(color.getArgb(scheme));
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  // テーマの色パレットの生成
  const paletteTones = PALETTE_KEYS.reduce((acc, key) => {
      acc[key] = Object.fromEntries(
        TONES.map((tone) => [
          tone,
          rgbaFromArgb(
            (
              scheme[`${key}Palette` as keyof DynamicScheme] as TonalPalette
            ).tone(tone),
          ),
        ]),
      );
      return acc;
    },
    {} as Record<string, Record<number, string>>,
  );

  // カスタムパレットの色の生成
  const customPaletteColorValues = customPaletteColors.reduce(
    (acc, { name, palette, lightTone, darkTone }) => {
      acc[name] = rgbaFromArgb(
        (
          scheme[`${palette}Palette` as keyof DynamicScheme] as TonalPalette
        ).tone(scheme.isDark ? darkTone : lightTone),
      );
      return acc;
    },
    {} as Record<string, string>,
  );

  // カスタム定義色の生成
  const customDefinedColorValues = customDefinedColors.reduce(
    (acc, { name, value }) => {
      acc[name] = value;
      return acc;
    },
    {} as Record<string, string>,
  );

  return {
    scheme,
    systemColors,
    paletteTones,
    customPaletteColors: customPaletteColorValues,
    customDefinedColors: customDefinedColorValues,
  };
};

// テーマの色スキーマをCSS変数に変換
export const colorThemeToCssVariables = (
  theme: ColorTheme,
): Record<string, string> => {
  const cssVars: Record<string, string> = {};

  Object.entries(theme.systemColors).forEach(([name, color]) => {
    cssVars[`--md-sys-color-${name.replace(/([A-Z])/g, "-$1").toLowerCase()}`] =
      color;
  });

  Object.entries(theme.paletteTones).forEach(([key, tones]) => {
    Object.entries(tones).forEach(([tone, color]) => {
      cssVars[`--md-ref-palette-${key}-${tone}`] = color;
    });
  });

  Object.entries(theme.customPaletteColors).forEach(([name, color]) => {
    cssVars[`--md-custom-color-${name}`] = color;
  });

  Object.entries(theme.customDefinedColors).forEach(([name, color]) => {
    cssVars[`--md-custom-color-${name}`] = color;
  });

  return cssVars;
};

// テーマに合わせて色を調整するユーティリティ関数 ex: トラックカラーをテーマにあわせる
export const adjustColorToTheme = (
  color: string,
  theme: ColorTheme,
  targetKey: PaletteKey = "primary",
): string => {
  const sourceHct = Hct.fromInt(argbFromHex(color));
  const targetPalette = theme.scheme[
    `${targetKey}Palette` as keyof DynamicScheme
  ] as TonalPalette;

  // テーマの色相と彩度を取得
  const themeHue = targetPalette.hue;
  const themeChroma = targetPalette.chroma;

  // 元の色の明度を保持しつつ、テーマの色相と彩度に合わせる
  const adjustedHct = Hct.from(
    themeHue,
    Math.min(sourceHct.chroma, themeChroma), // 彩度は元の色とテーマの低い方を選択
    sourceHct.tone,
  );

  return rgbaFromArgb(adjustedHct.toInt());
};
