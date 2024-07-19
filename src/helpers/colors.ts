import {
  hexFromArgb,
  argbFromHex,
  Hct,
  Contrast,
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

export const rgbaFromArgb = (argb: number, alpha: number = 1): string => {
  const r = (argb >> 16) & 255;
  const g = (argb >> 8) & 255;
  const b = argb & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
};

export const arrayFromRgba = (rgba: string): number[] => {
  const match = rgba.match(/^rgba\(([0-9]+), ([0-9]+), ([0-9]+), ([0-9.]+)\)$/);
  return match ? match.slice(1, 5).map(Number) : [];
};

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

const generateSystemColors = (
  scheme: DynamicScheme,
): Record<string, string> => {
  return Object.entries(MaterialDynamicColors).reduce(
    (acc, [name, color]) => {
      if (typeof color === "object" && "getArgb" in color) {
        acc[name] = hexFromArgb(color.getArgb(scheme));
      }
      return acc;
    },
    {} as Record<string, string>,
  );
};

const generatePaletteTones = (
  scheme: DynamicScheme,
): Record<ColorSchemeCorePalettes, Record<number, string>> => {
  return PALETTE_KEYS.reduce(
    (acc, key) => {
      acc[key] = Object.fromEntries(
        TONES.map((tone) => [
          tone,
          hexFromArgb(
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

const adjustCustomPaletteColors = (
  customColors: CustomPaletteColor[],
  scheme: DynamicScheme,
  isDark: boolean,
): Record<string, string> => {
  const sortedColors = [...customColors].sort((a, b) => {
    const toneA = isDark ? a.darkTone : a.lightTone;
    const toneB = isDark ? b.darkTone : b.lightTone;
    return toneA - toneB;
  });

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
      acc[color.name] = hexFromArgb(palette.tone(adjustedTone));
      return acc;
    },
    {} as Record<string, string>,
  );
};

export const generateColorScheme = (config: ColorSchemeConfig): ColorScheme => {
  const scheme = generateDynamicScheme(config);
  const systemColors = generateSystemColors(scheme);
  const paletteTones = generatePaletteTones(scheme);
  const customPaletteColors = adjustCustomPaletteColors(
    config.customPaletteColors,
    scheme,
    config.isDark,
  );

  const customDefinedColors = config.customDefinedColors.reduce(
    (acc, color) => {
      acc[color.name] = color.value;
      return acc;
    },
    {} as Record<string, string>,
  );

  const colorScheme = {
    scheme,
    systemColors,
    paletteTones,
    customPaletteColors,
    customDefinedColors,
    config,
  };

  const results = evaluateContrastAndGenerateResults(colorScheme, config);
  printContrastResults(results);

  return colorScheme;
};

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
    setColorVar("--md-custom-color-", cssName, color);
  });

  return cssVars;
};

interface ContrastCheckResult {
  color1: string;
  color2: string;
  contrastRatio: number;
  checkType: string;
  wcagAANormal: boolean;
  wcagAALarge: boolean;
  wcagAAANormal: boolean;
  wcagAAALarge: boolean;
  functionalCheck: string;
  designCheck: string;
  expectedContrastRatio?: number;
}

function getContrastRatio(
  color1: string,
  color2: string,
  colors: Record<string, string>,
): number {
  const hct1 = Hct.fromInt(argbFromHex(colors[color1]));
  const hct2 = Hct.fromInt(argbFromHex(colors[color2]));
  return Contrast.ratioOfTones(hct1.tone, hct2.tone);
}

function evaluateContrast(
  contrastRatio: number,
  checkType: string,
  color1: string,
  color2: string,
  expectedContrastRatio?: number,
): ContrastCheckResult {
  const wcagAANormal = contrastRatio >= 4.5;
  const wcagAALarge = contrastRatio >= 3;
  const wcagAAANormal = contrastRatio >= 7;
  const wcagAAALarge = contrastRatio >= 4.5;

  // 機能チェック
  let functionalCheck = "";
  // デザイン基準チェック
  let designCheck = "";

  switch (checkType) {
    case "text":
      functionalCheck = wcagAAANormal
        ? "Pass AAA"
        : wcagAANormal
          ? "Pass AA"
          : "Fail";
      designCheck = "N/A";
      break;
    case "largeText":
      functionalCheck = wcagAAALarge
        ? "Pass AAA"
        : wcagAALarge
          ? "Pass AA"
          : "Fail";
      designCheck = "N/A";
      break;
    case "ui":
      functionalCheck = wcagAALarge ? "Pass" : "Fail";
      designCheck = contrastRatio >= 3.0 ? "Good" : "Poor";
      break;
    case "structure":
      functionalCheck = contrastRatio >= 1.5 ? "Pass" : "Fail";
      designCheck = contrastRatio >= 1.5 ? "Good" : "Poor";
      break;
    case "decorative":
      functionalCheck = "N/A";
      designCheck = contrastRatio >= 1.2 ? "Good" : "Poor";
      break;
    case "custom":
      functionalCheck = "Custom";
      designCheck = "Custom";
      break;
  }

  return {
    color1,
    color2,
    contrastRatio,
    checkType,
    wcagAANormal,
    wcagAALarge,
    wcagAAANormal,
    wcagAAALarge,
    functionalCheck,
    designCheck,
    expectedContrastRatio,
  };
}

export function evaluateContrastAndGenerateResults(
  colorScheme: ColorScheme,
  config: ColorSchemeConfig,
): ContrastCheckResult[] {
  const results: ContrastCheckResult[] = [];
  const colors: Record<string, string> = {
    ...colorScheme.systemColors,
    ...colorScheme.customPaletteColors,
  };

  function checkContrast(
    color1: string,
    color2: string,
    checkType: string,
    expectedContrastRatio?: number,
  ) {
    if (!colors[color1] || !colors[color2]) {
      return;
    }

    const contrastRatio = getContrastRatio(color1, color2, colors);
    const result = evaluateContrast(
      contrastRatio,
      checkType,
      color1,
      color2,
      expectedContrastRatio,
    );
    if (
      expectedContrastRatio == undefined ||
      contrastRatio < expectedContrastRatio
    ) {
      results.push(result);
    }
  }

  const colorPairs = [
    { color1: "primary", color2: "onPrimary", type: "text", expected: 4.5 },
    {
      color1: "primaryContainer",
      color2: "onPrimaryContainer",
      type: "text",
      expected: 4.5,
    },
    { color1: "secondary", color2: "onSecondary", type: "text", expected: 4.5 },
    {
      color1: "secondaryContainer",
      color2: "onSecondaryContainer",
      type: "text",
      expected: 4.5,
    },
    { color1: "tertiary", color2: "onTertiary", type: "text", expected: 4.5 },
    {
      color1: "tertiaryContainer",
      color2: "onTertiaryContainer",
      type: "text",
      expected: 4.5,
    },
    { color1: "error", color2: "onError", type: "text", expected: 4.5 },
    {
      color1: "errorContainer",
      color2: "onErrorContainer",
      type: "text",
      expected: 4.5,
    },
    {
      color1: "background",
      color2: "onBackground",
      type: "text",
      expected: 4.5,
    },
    { color1: "surface", color2: "onSurface", type: "text", expected: 4.5 },
    {
      color1: "surfaceVariant",
      color2: "onSurfaceVariant",
      type: "text",
      expected: 4.5,
    },
    {
      color1: "inverseSurface",
      color2: "inverseOnSurface",
      type: "text",
      expected: 4.5,
    },
    { color1: "outline", color2: "background", type: "ui", expected: 3 },
    { color1: "outlineVariant", color2: "surface", type: "ui", expected: 1.5 },
  ];

  colorPairs.forEach((pair) => {
    checkContrast(pair.color1, pair.color2, pair.type, pair.expected);
  });

  ["primary", "secondary", "tertiary", "error"].forEach((color) => {
    checkContrast(color, "background", "ui", 3);
    checkContrast(color, "surface", "ui", 3);
  });

  config.customPaletteColors.forEach((customColor: CustomPaletteColor) => {
    if (customColor.contrastVs) {
      Object.entries(customColor.contrastVs).forEach(
        ([contrastColor, expectedRatio]) => {
          checkContrast(
            customColor.name,
            contrastColor,
            "custom",
            expectedRatio,
          );
        },
      );
    } else {
      checkContrast(customColor.name, "background", "ui");
      checkContrast(customColor.name, "surface", "ui");
    }
  });

  return results;
}

export function printContrastResults(results: ContrastCheckResult[]): void {
  if (results.length === 0) {
    console.log("All color check passed.");
    return;
  }

  console.warn("check following color contrast:");
  results.forEach((result) => {
    console.warn(`
    Colors: ${result.color1} vs ${result.color2}
    Check Type: ${result.checkType}
    Contrast Ratio: ${result.contrastRatio.toFixed(2)}:1
    ${result.expectedContrastRatio ? `Expect Contrast Ratio: ${result.expectedContrastRatio.toFixed(2)}:1` : ""}
    WCAG AA (Normal Text): ${result.wcagAANormal ? "Pass" : "Fail"}
    WCAG AA (Large Text/UI): ${result.wcagAALarge ? "Pass" : "Fail"}
    WCAG AAA (Normal Text): ${result.wcagAAANormal ? "Pass" : "Fail"}
    WCAG AAA (Large Text): ${result.wcagAAALarge ? "Pass" : "Fail"}
    Functional Check: ${result.functionalCheck}
    Design Check: ${result.designCheck}
    `);
  });
}
