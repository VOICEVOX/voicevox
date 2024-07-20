import Color from "colorjs.io";

import {
  OKLCHCoords,
  ColorSchemeConfig,
  ColorSchemeBaseColors,
  CustomColorConfig,
  ColorScheme,
  PALETTE_TONES,
  COLOR_ROLES,
} from "@/type/preload";

export const oklchFromHex = (hex: string): OKLCHCoords => {
  try {
    const color = new Color(hex);
    return [color.l, color.c, color.h];
  } catch (error) {
    console.warn(`Failed to convert hex to OKLCH: ${hex}`, error);
    return [0, 0, 0];
  }
};

export const hexFromOklch = (oklchCoords: OKLCHCoords): string => {
  try {
    const color = new Color("oklch", oklchCoords);
    return color.to("srgb").toString({ format: "hex" });
  } catch (error) {
    console.warn(`Failed to convert OKLCH to hex: ${oklchCoords}`, error);
    return "#FFFFFF";
  }
};

// OKLch色空間のパラメータ範囲
const MIN_L = 0;
const MAX_L = 1;
const MIN_C = 0;
const MAX_C = 0.5;

// ベースカラーの調整
export const adjustBaseColor = (
  baseColor: OKLCHCoords,
  chromaAdjustment: number = 0,
  hueAdjustment: number = 0,
): OKLCHCoords => {
  const color = new Color("oklch", baseColor);

  color.l = Math.max(MIN_L, Math.min(MAX_L, baseColor[0]));
  color.c = Math.max(MIN_C, Math.min(MAX_C, color.c + chromaAdjustment));
  color.h = (color.h + hueAdjustment) % 360;

  return [color.l, color.c, color.h];
};

// 補正明るさ取得
const getLightness = (
  baseColor: OKLCHCoords,
  toneValue: number,
  isDark: boolean,
): OKLCHCoords => {
  const toneColor = [...baseColor] as OKLCHCoords;
  toneColor[0] = toneValue / 100;
  if (isDark) {
    const baseLightness = 0.08 + (1 - toneValue / 100) * 0.08;
    toneColor[0] = baseLightness + (toneValue / 100) * 0.9;
  } else {
    // ライトモードはそのまま
    toneColor[0] = toneValue / 100;
  }

  return toneColor;
};

// カラーブレンド
export const blendColors = (
  color1: OKLCHCoords,
  color2: OKLCHCoords,
  amount: number,
): OKLCHCoords => {
  try {
    const c1 = new Color("oklch", color1);
    const c2 = new Color("oklch", color2);
    const blended = Color.mix(c1, c2, amount, { space: "oklch" });
    return [blended.oklch.l, blended.oklch.c, blended.oklch.h];
  } catch (error) {
    console.warn(`Failed to blend colors: ${color1}, ${color2}`, error);
    return color1;
  }
};

// コントラスト取得
export const getContrastRatio = (
  color1: OKLCHCoords,
  color2: OKLCHCoords,
): number => {
  try {
    const c1 = new Color("oklch", color1);
    const c2 = new Color("oklch", color2);
    return Color.contrastWCAG21(c1, c2);
  } catch (error) {
    console.warn(`Failed to get contrast ratio: ${color1}, ${color2}`, error);
    return 1;
  }
};

// パレット生成
export const generatePalette = (
  baseColors: ColorSchemeBaseColors,
  isDark: boolean,
): Record<string, OKLCHCoords> => {
  const palette: Record<string, OKLCHCoords> = {};
  Object.entries(baseColors).forEach(([key, colorValue]) => {
    const baseColor = adjustBaseColor(colorValue, 0, 0);
    PALETTE_TONES.forEach((tone) => {
      palette[`${key}${tone}`] = getLightness(baseColor, tone, isDark);
    });
  });
  return palette;
};

// カスタムカラー生成
export const generateCustomColors = (
  customColors: CustomColorConfig[],
  baseColors: ColorSchemeBaseColors,
  isDark: boolean,
  palette: Record<string, OKLCHCoords>,
): Record<string, OKLCHCoords> => {
  const customColorMap: Record<string, OKLCHCoords> = {};

  customColors.forEach((config) => {
    const baseColor = adjustBaseColor(baseColors[config.palette], 0, 0);
    const tone = isDark ? config.darkLightness : config.lightLightness;
    let color = getLightness(baseColor, tone, isDark);

    if (config.blend) {
      // NOTE: いったんパレットから選択
      const surfaceColor = palette[isDark ? "neutral10" : "neutral99"];
      color = blendColors(color, surfaceColor, 0.15);
    }

    customColorMap[config.name] = color;
  });

  return customColorMap;
};

// コントラストターゲットにあわせる(仮)
const adjustColorsForContrast = (
  colors: Record<string, OKLCHCoords>,
  contrastVersus: Record<string, Record<string, number>>,
  isDark: boolean,
): Record<string, OKLCHCoords> => {
  const adjustedColors = { ...colors };

  Object.entries(contrastVersus).forEach(([colorName, versus]) => {
    Object.entries(versus).forEach(([contrastAgainst, minContrast]) => {
      if (adjustedColors[colorName] && adjustedColors[contrastAgainst]) {
        const currentContrast = getContrastRatio(
          adjustedColors[colorName],
          adjustedColors[contrastAgainst],
        );
        let loopIndex = 0;
        const isStopLoop = 10;

        while (currentContrast < minContrast && loopIndex < isStopLoop) {
          const [l, c, h] = adjustedColors[colorName];
          const lightnessAdjustment = isDark ? -0.005 : 0.005;
          const chromaAdjustment = isDark ? -0.001 : 0.001;

          adjustedColors[colorName] = [
            l + lightnessAdjustment,
            Math.max(0, c + chromaAdjustment * (isDark ? -1 : 1)),
            (h + lightnessAdjustment * 2) % 360,
          ];
          loopIndex++;
        }
      }
    });
  });

  return adjustedColors;
};

// カラースキーム生成
export const generateColorScheme = (config: ColorSchemeConfig): ColorScheme => {
  const palette = generatePalette(config.baseColors, config.isDark);

  const roles: Record<string, OKLCHCoords> = {};
  Object.entries(COLOR_ROLES).forEach(([name, [base, light, dark]]) => {
    roles[name] = getLightness(
      adjustBaseColor(config.baseColors[base], 0, 0),
      config.isDark ? dark : light,
      config.isDark,
    );
  });

  const customColors = generateCustomColors(
    config.customColors ?? [],
    config.baseColors,
    config.isDark,
    palette,
  );

  const contrastVersus: Record<string, Record<string, number>> = {};
  config.customColors?.forEach((color) => {
    if (color.contrastVs) {
      contrastVersus[color.name] = color.contrastVs;
    }
  });

  const adjustedCustomColors = adjustColorsForContrast(
    customColors,
    contrastVersus,
    config.isDark,
  );

  const scheme = {
    config,
    palette,
    roles,
    customColors: adjustedCustomColors,
  };

  const report = evaluateContrastAndGenerateResults(scheme, config);
  printContrastResults(report);

  return scheme;
};

// CSSVariablesにコンバート
export const cssVariablesFromColorScheme = (
  colorScheme: ColorScheme,
): Record<string, string> => {
  const cssVars: Record<string, string> = {};

  const toKebabCase = (str: string) => {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  };

  const setColorVar = (prefix: string, key: string, value: OKLCHCoords) => {
    cssVars[`--${prefix}-${toKebabCase(key)}`] = hexFromOklch(value);
    cssVars[`--${prefix}-${toKebabCase(key)}-oklch`] =
      `oklch(${value[0]} ${value[1]} ${value[2]})`;
  };

  // パレットのCSS変数
  Object.entries(colorScheme.palette).forEach(([key, value]) => {
    setColorVar("md-ref-palette", key, value);
  });

  // ロールのCSS変数
  Object.entries(colorScheme.roles).forEach(([key, value]) => {
    setColorVar("md-sys-color", key, value);
  });

  // カスタムカラーのCSS変数
  Object.entries(colorScheme.customColors).forEach(([key, value]) => {
    setColorVar("md-custom-color", key, value);
  });

  return cssVars;
};

// コントラストチェック結果のインターフェース
interface ContrastCheckResult {
  color1Name: string;
  color2Name: string;
  color1: OKLCHCoords;
  color2: OKLCHCoords;
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

// コントラスト評価関数
function evaluateContrast(
  contrastRatio: number,
  checkType: string,
  color1Name: string,
  color2Name: string,
  color1: OKLCHCoords,
  color2: OKLCHCoords,
  expectedContrastRatio?: number,
): ContrastCheckResult {
  const wcagAANormal = contrastRatio >= 4.5;
  const wcagAALarge = contrastRatio >= 3;
  const wcagAAANormal = contrastRatio >= 7;
  const wcagAAALarge = contrastRatio >= 4.5;

  let functionalCheck = "";
  let designCheck = "";

  switch (checkType) {
    case "text":
      functionalCheck = wcagAAANormal
        ? "Pass AAA"
        : wcagAANormal
          ? "Pass AA"
          : "Fail";
      designCheck = contrastRatio >= 4.5 ? "Good" : "Poor";
      break;
    case "largeText":
      functionalCheck = wcagAAALarge
        ? "Pass AAA"
        : wcagAALarge
          ? "Pass AA"
          : "Fail";
      designCheck = contrastRatio >= 3 ? "Good" : "Poor";
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
      functionalCheck =
        contrastRatio >= expectedContrastRatio! ? "Pass" : "Fail";
      designCheck = contrastRatio >= expectedContrastRatio! ? "Good" : "Poor";
      break;
    default:
      functionalCheck = "Unknown";
      designCheck = "Unknown";
  }

  return {
    color1,
    color2,
    color1Name,
    color2Name,
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
  const colors: Record<string, OKLCHCoords> = {
    ...colorScheme.roles,
    ...colorScheme.customColors,
  };

  function checkContrast(
    color1Name: string,
    color2Name: string,
    checkType: string,
    expectedContrastRatio?: number,
  ) {
    const color1 = colors[color1Name];
    const color2 = colors[color2Name];
    if (!color1 || !color2) {
      console.warn(`Could not find colors: ${color1Name} or ${color2Name}`);
      return;
    }
    const contrastRatio = getContrastRatio(color1, color2);
    const result = evaluateContrast(
      contrastRatio,
      checkType,
      color1Name,
      color2Name,
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

  const standardChecks = [
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
    {
      color1: "outlineVariant",
      color2: "surface",
      type: "structure",
      expected: 1.5,
    },
  ];

  standardChecks.forEach((check) => {
    checkContrast(check.color1, check.color2, check.type, check.expected);
  });

  ["primary", "secondary", "tertiary", "error"].forEach((color) => {
    checkContrast(color, "background", "ui", 3);
    checkContrast(color, "surface", "ui", 3);
  });

  config.customColors?.forEach((customColor: CustomColorConfig) => {
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
    console.log("All color checks passed.");
    return;
  }

  console.warn("The following color contrasts need attention:");
  results.forEach((result) => {
    console.warn(`
    Name: ${result.color1Name}
    Colors: ${hexFromOklch(result.color1)} vs ${hexFromOklch(result.color2)}
    Check Type: ${result.checkType}
    Contrast Ratio: ${result.contrastRatio.toFixed(2)}:1
    ${result.expectedContrastRatio ? `Expected Contrast Ratio: ${result.expectedContrastRatio.toFixed(2)}:1` : ""}
    WCAG AA (Normal Text): ${result.wcagAANormal ? "Pass" : "Fail"}
    WCAG AA (Large Text/UI): ${result.wcagAALarge ? "Pass" : "Fail"}
    WCAG AAA (Normal Text): ${result.wcagAAANormal ? "Pass" : "Fail"}
    WCAG AAA (Large Text): ${result.wcagAAALarge ? "Pass" : "Fail"}
    Functional Check: ${result.functionalCheck}
    Design Check: ${result.designCheck}
    `);
  });
}
