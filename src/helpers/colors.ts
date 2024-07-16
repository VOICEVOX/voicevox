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

import {
  ColorSchemeConfig,
  PaletteKey,
  ColorAdjustment,
  ThemeOptions,
  SchemeVariant,
  ColorTheme,
} from "@/type/preload";

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
  if (adjustment.hex) {
    // HEX指定されている場合はHEX値からトーナルパレットを作成
    const hexHct = Hct.fromInt(argbFromHex(adjustment.hex));
    return TonalPalette.fromHueAndChroma(hexHct.hue, hexHct.chroma);
  } else {
    // 色相、彩度、明度を指定されている場合はテーマパレットを調整
    const hue = adjustment.hue != undefined ? adjustment.hue : palette.hue;
    const chroma =
      adjustment.chroma != undefined ? adjustment.chroma : palette.chroma;
    const tone = adjustment.tone != undefined ? adjustment.tone : 50;
    return TonalPalette.fromHueAndChroma(
      Hct.from(hue, chroma, tone).hue,
      Hct.from(hue, chroma, tone).chroma,
    );
  }
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
  schemeConfig: ColorSchemeConfig,
): ColorTheme => {
  const scheme = createDynamicScheme({
    sourceColor: schemeConfig.sourceColor,
    variant: schemeConfig.variant,
    isDark: schemeConfig.isDark,
    contrastLevel: schemeConfig.contrastLevel,
    adjustments: schemeConfig.adjustments,
  });

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
  const paletteTones = PALETTE_KEYS.reduce(
    (acc, key) => {
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
  const customPaletteColors = schemeConfig.customPaletteColors.reduce(
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
  const customDefinedColors = schemeConfig.customDefinedColors.reduce(
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
    customPaletteColors,
    customDefinedColors,
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
