import Color from "colorjs.io";

import {
  ColorSchemeConfig,
  ColorScheme,
  ColorSpace,
  ColorName,
  ColorPalette,
  CSSColorString,
  OklchColorArray,
  ColorType,
  ColorSet,
} from "./types";

import { colorRoles } from "./constants";
import { defaultGenerator } from "./generator";

// 色変換関数
export const toOklchArray = (colorString: CSSColorString): OklchColorArray => {
  try {
    const color = new Color(colorString);
    const oklch = color.to("oklch");
    return [oklch.l, oklch.c, oklch.h];
  } catch (error) {
    throw new Error(`Failed to convert color to OKLCH: ${error}`);
  }
};

export const fromOklchArray = (oklch: OklchColorArray): CSSColorString => {
  return new Color("oklch", oklch).toString();
};

export const toCssString = (
  colorArray: OklchColorArray,
  format: ColorSpace = "oklch",
): CSSColorString => {
  try {
    const color = new Color("oklch", colorArray);
    switch (format) {
      case "oklch":
        return color.toString({ format: "oklch" });
      case "hex":
        return color.to("srgb").toString({ format: "hex" });
      case "rgb":
        return color.to("srgb").toString();
      case "p3":
        return color.to("p3").toString();
      default:
        throw new Error(`Unsupported color format: ${format}`);
    }
  } catch (error) {
    throw new Error(`Failed to convert color to CSS string: ${error}`);
  }
};

// 色調整関数
export const adjustLightness = (
  color: OklchColorArray,
  delta: number,
): OklchColorArray => {
  const [l, c, h] = color;
  return [l + delta, c, h];
};

export const adjustChroma = (
  color: OklchColorArray,
  delta: number,
): OklchColorArray => {
  const [l, c, h] = color;
  return [l, c + delta, h];
};

export const adjustHue = (
  color: OklchColorArray,
  delta: number,
): OklchColorArray => {
  const [l, c, h] = color;
  return [l, c, (h + delta) % 360];
};

// パレットの生成
export const createPalette = (
  baseColor: OklchColorArray,
  type: ColorType,
): ColorPalette => {
  try {
    return {
      name: type,
      colors: defaultGenerator(baseColor, type),
    };
  } catch (error) {
    throw new Error(`Failed to create palette for ${type}: ${error}`);
  }
};

// パレットから明度にあわせた色を取得
const getColorFromPalette = (
  palette: ColorPalette,
  lightness: number,
): string => {
  try {
    const closestKey = Object.keys(palette.colors)
      .map(Number)
      .reduce((a, b) =>
        Math.abs(b - lightness) < Math.abs(a - lightness) ? b : a,
      );
    return palette.colors[closestKey];
  } catch (error) {
    throw new Error(`Failed to get color from palette: ${error}`);
  }
};

// ColorSchemeを生成
// NOTE: 大きいので分割
export const createColorScheme = (config: ColorSchemeConfig): ColorScheme => {
  try {
    // パレットの生成
    const createPaletteFromConfig = (
      colorType: ColorType,
      colorString?: string,
    ): ColorPalette => {
      const baseColor = colorString
        ? toOklchArray(colorString)
        : toOklchArray(config.primary);
      return createPalette(baseColor, colorType);
    };

    const palettes: Record<ColorType, ColorPalette> = {
      primary: createPaletteFromConfig("primary", config.primary),
      secondary: createPaletteFromConfig("secondary", config.secondary),
      tertiary: createPaletteFromConfig("tertiary", config.tertiary),
      neutral: createPaletteFromConfig("neutral", config.neutral),
      neutralVariant: createPaletteFromConfig(
        "neutralVariant",
        config.neutralVariant,
      ),
      error: createPaletteFromConfig("error", config.error),
    };

    // ロールに基づいた色の生成
    const roles = colorRoles.reduce(
      (acc, role) => {
        const palette = palettes[role.palette];
        if (!palette) {
          throw new Error(`Palette not found for role: ${role.name}`);
        }
        return {
          ...acc,
          [role.name]: {
            light: getColorFromPalette(palette, role.light),
            dark: getColorFromPalette(palette, role.dark),
          },
        };
      },
      {} as Record<ColorName, ColorSet>,
    );

    // エイリアスカラーの生成
    // (eg. buttonBackground: primaryかつ明度0.1などパレットから明度取得)
    const aliasColors = (config.aliasColors || []).reduce(
      (acc, aliasColor) => {
        const palette = palettes[aliasColor.palette];
        if (!palette) {
          throw new Error(`Palette not found for role: ${aliasColor.palette}`);
        }
        return {
          ...acc,
          [aliasColor.name]: {
            light: getColorFromPalette(palette, aliasColor.light),
            dark: getColorFromPalette(palette, aliasColor.dark),
          },
        };
      },
      {} as Record<ColorName, ColorSet>,
    );

    /*
    // カスタムカラー
    // (eg. customButtonBackground: secondaryと同じロジック+Hueが違うなど / onCustomButtonなど派生ロール)
    // カスタムカラーの生成
    const customColors = (config.customColors || []).reduce(
      (acc, customColor) => {
        const customPalette = createPalette(
          toOklchArray(customColor.sourceColor),
          customColor.palette,
        );
        const baseRole = colorRoles.find(
          (role) => role.name === customColor.palette,
        );
        if (!baseRole) {
          throw new Error(
            `Base role not found for custom color: ${customColor.name}`,
          );
        }

        const mainColor = {
          [customColor.name]: {
            source: customColor.sourceColor,
            light: getColorFromPalette(customPalette, baseRole.light),
            dark: getColorFromPalette(customPalette, baseRole.dark),
          },
        };

        const derivedRoles = [
          { name: `on${customColor.name}`, light: 1, dark: 0.3 },
          { name: `${customColor.name}Container`, light: 0.9, dark: 0.4 },
          { name: `on${customColor.name}Container`, light: 0.2, dark: 0.9 },
        ];

        const derivedColors = derivedRoles.reduce(
          (derivedAcc, role) => {
            derivedAcc[role.name] = {
              light: getColorFromPalette(customPalette, role.light),
              dark: getColorFromPalette(customPalette, role.dark),
            };
            return derivedAcc;
          },
          {} as Record<ColorName, { light: string; dark: string }>,
        );

        return {
          ...acc,
          ...mainColor,
          ...derivedColors,
        };
      },
      {} as Record<string, { light: string; dark: string }>,
    ); */

    return {
      name: config.name,
      displayName: config.displayName,
      palettes,
      roles,
      aliasColors,
      customColors: {},
      config,
    };
  } catch (error) {
    throw new Error(`Failed to create color scheme: ${error}`);
  }
};

export const cssVariablesFromColorScheme = (
  colorScheme: ColorScheme,
): Record<string, string> => {
  const cssVars: Record<string, string> = {};

  const toKebabCase = (str: string) => {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  };

  // roles の CSS 変数
  Object.entries(colorScheme.roles).forEach(([key, value]) => {
    cssVars[`--md-sys-color-${toKebabCase(key)}-light`] = value.light;
    cssVars[`--md-sys-color-${toKebabCase(key)}-dark`] = value.dark;
  });

  // aliasColors の CSS 変数
  Object.entries(colorScheme.aliasColors).forEach(([key, value]) => {
    cssVars[`--md-custom-color-${toKebabCase(key)}-light`] = value.light;
    cssVars[`--md-custom-color-${toKebabCase(key)}-dark`] = value.dark;
  });

  // customColors の CSS 変数
  Object.entries(colorScheme.customColors).forEach(([key, value]) => {
    cssVars[`--md-custom-color-${toKebabCase(key)}-light`] = value.light;
    cssVars[`--md-custom-color-${toKebabCase(key)}-dark`] = value.dark;
  });

  return cssVars;
};
