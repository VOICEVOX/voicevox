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
  ColorScheme,
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

export const arrayFromRgba = (rgba: string): number[] => {
  const match = rgba.match(/^rgba\(([0-9]+), ([0-9]+), ([0-9]+), ([0-9.]+)\)$/);
  return match
    ? [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])]
    : [];
};

// テーマパレットの調整
export const adjustPalette = (
  palette: TonalPalette,
  adjustment: ColorAdjustment,
): TonalPalette => {
  let hct: Hct;

  if (adjustment.hex) {
    // HEX指定されている場合はHEX値からHCTを作成
    hct = Hct.fromInt(argbFromHex(adjustment.hex));
  } else {
    // HEX指定がない場合は既存のパレットの値を使用
    hct = Hct.from(palette.hue, palette.chroma, 50); // トーンは50をデフォルトとする
  }

  // hue, chroma, toneが指定されている場合は上書き
  const hue = adjustment.hue != undefined ? adjustment.hue : hct.hue;
  const chroma =
    adjustment.chroma != undefined ? adjustment.chroma : hct.chroma;
  const tone = adjustment.tone != undefined ? adjustment.tone : hct.tone;

  // 調整された値でHCTオブジェクトを作成
  const adjustedHct = Hct.from(hue, chroma, tone);

  // 調整されたHCTオブジェクトからトーナルパレットを作成
  return TonalPalette.fromHueAndChroma(adjustedHct.hue, adjustedHct.chroma);
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

// テーマの色スキーマの生成
export const generateColorScheme = (
  colorSchemeConfig: ColorSchemeConfig,
): ColorScheme => {
  const scheme = createDynamicScheme({
    sourceColor: colorSchemeConfig.sourceColor,
    variant: colorSchemeConfig.variant,
    isDark: colorSchemeConfig.isDark,
    contrastLevel: colorSchemeConfig.contrastLevel,
    adjustments: colorSchemeConfig.adjustments,
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
  const customPaletteColors = colorSchemeConfig.customPaletteColors.reduce(
    (
      acc: { [x: string]: string },
      {
        name,
        palette,
        lightTone,
        darkTone,
      }: {
        name: string;
        palette: PaletteKey;
        lightTone: number;
        darkTone: number;
      },
    ) => {
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
  const customDefinedColors = colorSchemeConfig.customDefinedColors.reduce(
    (
      acc: Record<string, string>,
      { name, value }: { name: string; value: string },
    ) => {
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
    colorSchemeConfig,
  };
};

// テーマの色スキーマをCSS変数に変換
export const colorSchemeToCssVariables = (
  theme: ColorScheme,
): Record<string, string> => {
  const cssVars: Record<string, string> = {};

  const setColorVar = (prefix: string, name: string, color: string) => {
    const rgba = arrayFromRgba(color);
    if (rgba.length >= 3) {
      cssVars[`${prefix}${name}-rgb`] = `${rgba[0]}, ${rgba[1]}, ${rgba[2]}`;
    }
    cssVars[`${prefix}${name}`] = color;
  };

  Object.entries(theme.systemColors).forEach(([name, color]) => {
    const cssName = name.replace(/([A-Z])/g, "-$1").toLowerCase();
    setColorVar("--md-sys-color-", cssName, color as string);
  });

  Object.entries(
    theme.paletteTones as Record<string, Record<number, string>>,
  ).forEach(([key, tones]) => {
    Object.entries(tones).forEach(([tone, color]) => {
      setColorVar(`--md-ref-palette-${key}-`, tone, color as string);
    });
  });

  Object.entries(theme.customPaletteColors).forEach(([name, color]) => {
    setColorVar("--md-custom-color-", name, color as string);
  });

  Object.entries(theme.customDefinedColors).forEach(([name, color]) => {
    setColorVar("--md-custom-color-", name, color as string);
  });

  return cssVars;
};

// テーマに合わせて色を調整するユーティリティ関数 ex: トラックカラーをテーマにあわせる
export const adjustColorToTheme = (
  color: string,
  theme: ColorScheme,
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
