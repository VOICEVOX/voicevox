import Color from "colorjs.io";

import {
  OklchColor,
  ColorRole,
  ColorAlgorithm,
  ColorSchemeConfig,
  ColorPalette,
  ColorScheme,
} from "./types";

import { DEFINED_COLOR_ROLES, PALETTE_SHADES } from "./constants";

// 色変換ユーティリティ
export const fromCssString = (colorString: string): OklchColor => {
  const color = new Color(colorString).to("oklch");
  return [color.l, color.c, color.h];
};

export const toCssString = (
  oklchColor: OklchColor,
  format: "oklch" | "hex" | "rgb" | "p3" = "oklch",
): string => {
  const color = new Color("oklch", [...oklchColor]);
  return color.to(format === "oklch" ? "oklch" : "srgb").toString({ format });
};

export const adjustLightness = (
  color: OklchColor,
  delta: number,
): OklchColor => [color[0] + delta, color[1], color[2]];

// カラー生成アルゴリズム
export const defaultAlgorithm: ColorAlgorithm = (
  config: ColorSchemeConfig,
  baseColor: OklchColor,
  targetRole: ColorRole,
  shade: number,
): OklchColor => {
  const [, baseC, baseH] = baseColor;
  const targetL = shade;
  let targetC: number;
  let targetH: number;

  const defaultC = Math.max(baseC, 0.115);

  switch (targetRole) {
    case "primary":
      targetC = defaultC;
      targetH = baseH;
      break;
    case "secondary":
      targetC = defaultC / 3;
      targetH = baseH;
      break;
    case "tertiary":
      targetC = defaultC;
      targetH = (baseH - 60) % 360;
      break;
    case "neutral":
      targetC = 0.0;
      targetH = baseH;
      break;
    case "neutralVariant":
      targetC = 0.01;
      targetH = baseH;
      break;
    case "error":
      targetC = defaultC * 1.2;
      targetH = 30;
      break;
    default:
      targetC = defaultC;
      targetH = baseH;
  }

  return [targetL, targetC, targetH];
};

// PALETTE_SHADESから固定明度パレットを生成
export const generatePalette = (
  config: ColorSchemeConfig,
  baseColor: OklchColor,
  role: ColorRole,
  algorithm: ColorAlgorithm,
): ColorPalette => {
  const shades: Record<number, OklchColor> = {};
  PALETTE_SHADES.forEach((shade: number) => {
    shades[shade] = algorithm(config, baseColor, role, shade);
  });
  return { name: role, shades };
};

// ロールごとのカラーを生成
export const generateRoles = (
  config: ColorSchemeConfig,
  baseColor: OklchColor,
  roleConfig: {
    name: string;
    role: ColorRole;
    lightShade: number;
    darkShade: number;
  }[],
  algorithm: ColorAlgorithm,
): Record<string, { light: OklchColor; dark: OklchColor }> => {
  return roleConfig.reduce(
    (roles, { name, role, lightShade, darkShade }) => {
      roles[name] = {
        light: algorithm(config, baseColor, role, lightShade),
        dark: algorithm(config, baseColor, role, darkShade),
      };
      return roles;
    },
    {} as Record<string, { light: OklchColor; dark: OklchColor }>,
  );
};

// 設定バリデーション
export const isValidColorSchemeConfig = (
  config: ColorSchemeConfig,
): boolean => {
  // impl
  return config != undefined;
};

// 設定からカラースキームを生成
// カラースキーム生成
export const generateColorSchemeFromConfig = (
  config: ColorSchemeConfig,
  algorithm: ColorAlgorithm = defaultAlgorithm,
): ColorScheme => {
  if (config.baseColors.primary == undefined) {
    throw new Error("primary color is required");
  }
  const primaryColor = fromCssString(config.baseColors.primary);
  const definedRoles = generateRoles(
    config,
    primaryColor,
    DEFINED_COLOR_ROLES,
    algorithm,
  );
  const aliasRoles = config.aliasColors
    ? generateRoles(config, primaryColor, config.aliasColors, algorithm)
    : {};

  const customPalettes: Record<string, ColorPalette> = {};
  const customRoles: Record<string, { light: OklchColor; dark: OklchColor }> =
    {};

  config.customColors?.forEach(({ name, color }) => {
    const customBaseColor = fromCssString(color);
    customPalettes[name] = generatePalette(
      config,
      customBaseColor,
      name,
      algorithm,
    );

    const customColorRoleConfigs = [
      { variant: "", lightShade: 0.48, darkShade: 0.8 },
      { variant: "Container", lightShade: 0.92, darkShade: 0.4 },
      { variant: "On", lightShade: 1, darkShade: 0.32 },
      { variant: "OnContainer", lightShade: 0.24, darkShade: 0.92 },
    ];

    customColorRoleConfigs.forEach(({ variant, lightShade, darkShade }) => {
      const roleName = `${name}${variant}`;
      customRoles[roleName] = {
        light: algorithm(config, customBaseColor, "primary", lightShade),
        dark: algorithm(config, customBaseColor, "primary", darkShade),
      };
    });
  });

  return {
    name: config.name,
    displayName: config.displayName,
    palettes: { ...customPalettes },
    roles: { ...definedRoles, ...aliasRoles, ...customRoles },
    config,
  };
};

// カラースキームからCSS Variables生成
export const cssVariablesFromColorScheme = (
  colorScheme: ColorScheme,
  withPalette: boolean = false,
  prefix: string = "--scheme-color-",
): Record<string, string> => {
  const toKebabCase = (str: string) => {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  };

  return Object.entries(colorScheme.roles).reduce(
    (cssVars, [key, value]) => {
      cssVars[`${prefix}${toKebabCase(key)}-light`] = toCssString(
        value.light,
        "oklch",
      );
      cssVars[`${prefix}${toKebabCase(key)}-dark`] = toCssString(
        value.dark,
        "oklch",
      );
      if (withPalette) {
        Object.entries(colorScheme.palettes).forEach(
          ([paletteName, palette]) => {
            Object.entries(palette.shades).forEach(([shade, color]) => {
              const shadeName = Number(shade) * 100;
              cssVars[
                `${prefix}${toKebabCase(key)}-palette-${paletteName}-${shadeName}`
              ] = toCssString(color, "oklch");
            });
          },
        );
      }
      return cssVars;
    },
    {} as Record<string, string>,
  );
};
