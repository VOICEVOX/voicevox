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
  CustomColor,
  CustomColorGroup,
  customColor,
} from "@material/material-color-utilities";

import {
  ColorScheme,
  ColorSchemeConfig,
  ColorSchemeCorePalettes,
  ColorSchemeAdjustment,
  CustomPaletteColor,
  CustomDefinedColor,
} from "@/type/preload";

const SCHEME_CONSTRUCTORS = {
  content: SchemeContent,
  tonalSpot: SchemeTonalSpot,
  neutral: SchemeNeutral,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  fidelity: SchemeFidelity,
  monochrome: SchemeMonochrome,
  rainbow: SchemeRainbow,
  fruitSalad: SchemeFruitSalad,
} as const;

const PALETTE_KEYS = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
  "error",
] as const;

const TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100] as const;

// ARGBからRGBAに変換
export const rgbaFromArgb = (argb: number, alpha: number = 1): string => {
  const r = (argb >> 16) & 255;
  const g = (argb >> 8) & 255;
  const b = argb & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
};

// RGBAから数値配列に変換
export const arrayFromRgba = (rgba: string): number[] => {
  const match = rgba.match(/^rgba\(([0-9]+), ([0-9]+), ([0-9]+), ([0-9.]+)\)$/);
  return match ? match.slice(1, 5).map(Number) : [];
};

// パレット事前調整
const createAdjustedPalette = (
  palette: TonalPalette,
  adjustment: ColorSchemeAdjustment,
): TonalPalette => {
  const baseHct = adjustment.hex
    ? Hct.fromInt(argbFromHex(adjustment.hex))
    : Hct.from(palette.hue, palette.chroma, 50);

  const adjustedHct = Hct.from(
    adjustment.hue ?? baseHct.hue,
    adjustment.chroma ?? baseHct.chroma,
    adjustment.tone ?? baseHct.tone,
  );

  return TonalPalette.fromHueAndChroma(adjustedHct.hue, adjustedHct.chroma);
};

// M3のダイナミックスキーム生成
const generateDynamicScheme = (config: ColorSchemeConfig): DynamicScheme => {
  const {
    sourceColor,
    variant = "tonalSpot",
    isDark = false,
    contrastLevel = 0,
    adjustments,
  } = config;
  const sourceHct = Hct.fromInt(argbFromHex(sourceColor));
  const SchemeConstructor = SCHEME_CONSTRUCTORS[variant];
  let scheme = new SchemeConstructor(sourceHct, isDark, contrastLevel);

  if (adjustments) {
    const adjustedPalettes = Object.entries(adjustments).reduce(
      (acc, [key, adjustment]) => {
        if (adjustment) {
          acc[`${key}Palette`] = createAdjustedPalette(
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

// システムカラー生成
const generateSystemColors = (
  scheme: DynamicScheme,
): Record<string, string> => {
  return Object.entries(MaterialDynamicColors).reduce(
    (acc, [name, color]) => {
      if (typeof color === "object" && "getArgb" in color) {
        acc[name] = rgbaFromArgb(color.getArgb(scheme));
      }
      return acc;
    },
    {} as Record<string, string>,
  );
};

// パレットの色域生成
const generatePaletteTones = (
  scheme: DynamicScheme,
): Record<ColorSchemeCorePalettes, Record<number, string>> => {
  return PALETTE_KEYS.reduce(
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
    {} as Record<ColorSchemeCorePalettes, Record<number, string>>,
  );
};

// カスタムカラーの調整
// TODO: ContrastやBlendを使う
const adjustCustomPaletteColors = (
  customColors: CustomPaletteColor[],
  scheme: DynamicScheme,
  isDark: boolean,
): Record<string, string> => {
  // ソート
  const sortedColors = [...customColors].sort((a, b) => {
    const toneA = isDark ? a.darkTone : a.lightTone;
    const toneB = isDark ? b.darkTone : b.lightTone;
    return toneA - toneB;
  });

  // トーンを調整
  const adjustTone = (
    tone: number,
    index: number,
    contrastLevel: number,
  ): number => {
    const direction = index < sortedColors.length / 2 ? -1 : 1;
    const adjustmentFactor =
      Math.abs(index - (sortedColors.length - 1) / 2) /
      ((sortedColors.length - 1) / 2);
    const adjustment = direction * contrastLevel * 10 * adjustmentFactor;
    return Math.max(0, Math.min(100, tone + adjustment));
  };

  return sortedColors.reduce(
    (acc, color, index) => {
      const palette = scheme[
        `${color.palette}Palette` as keyof DynamicScheme
      ] as TonalPalette;
      const tone = isDark ? color.darkTone : color.lightTone;
      const adjustedTone = adjustTone(tone, index, scheme.contrastLevel);
      acc[color.name] = rgbaFromArgb(palette.tone(adjustedTone));
      return acc;
    },
    {} as Record<string, string>,
  );
};

export const generateCustomDefinedColors = (
  sourceColorHex: string,
  customDefinedColors: CustomDefinedColor[],
): CustomColorGroup[] => {
  const customColorGroups: CustomColorGroup[] = customDefinedColors.map(
    (customDefinedColor: CustomDefinedColor) => {
      const customColorValue = {
        ...customDefinedColor,
        value: argbFromHex(customDefinedColor.value),
      };
      return customColor(
        argbFromHex(sourceColorHex),
        customColorValue as CustomColor,
      );
    },
  );

  return customColorGroups;
};

// カラースキームの生成
export const generateColorScheme = (config: ColorSchemeConfig): ColorScheme => {
  const scheme = generateDynamicScheme(config);
  const systemColors = generateSystemColors(scheme);
  const paletteTones = generatePaletteTones(scheme);
  const customPaletteColors = adjustCustomPaletteColors(
    config.customPaletteColors,
    scheme,
    config.isDark,
  );
  const customDefinedColors = generateCustomDefinedColors(
    config.sourceColor,
    config.customDefinedColors,
  );

  return {
    scheme,
    systemColors,
    paletteTones,
    customPaletteColors,
    customDefinedColors,
    config,
  };
};

// カラースキームをCSS Variablesに変換
export const colorSchemeToCssVariables = (
  colorScheme: ColorScheme,
): Record<string, string> => {
  const cssVars: Record<string, string> = {};

  const toKebabCase = (str: string) => {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  };

  const setColorVar = (prefix: string, name: string, color: string) => {
    const rgba = arrayFromRgba(color);
    if (rgba.length >= 3) {
      cssVars[`${prefix}${name}-rgb`] = `${rgba[0]}, ${rgba[1]}, ${rgba[2]}`;
    }
    cssVars[`${prefix}${name}`] = color;
  };

  Object.entries(colorScheme.systemColors).forEach(([name, color]) => {
    const cssName = toKebabCase(name);
    setColorVar("--md-sys-color-", cssName, color);
  });

  Object.entries(colorScheme.paletteTones).forEach(([key, tones]) => {
    Object.entries(tones).forEach(([tone, color]) => {
      const cssName = toKebabCase(key);
      setColorVar(`--md-ref-palette-${cssName}-`, tone, color);
    });
  });

  Object.entries(colorScheme.customPaletteColors).forEach(([name, color]) => {
    const cssName = toKebabCase(name);
    setColorVar("--md-custom-color-", cssName, color);
  });

  Object.entries(colorScheme.customDefinedColors).forEach(([name, color]) => {
    const cssName = toKebabCase(name);
    setColorVar("--md-custom-color-", cssName, rgbaFromArgb(color.value));
  });

  return cssVars;
};
