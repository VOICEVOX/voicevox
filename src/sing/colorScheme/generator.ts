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
  targetRole: ColorRole,
  shade: number,
): OklchColor => {
  const primaryColorString = config.baseColors.primary;
  if (!primaryColorString) {
    throw new Error(
      "Primary color must be defined in the color scheme config.",
    );
  }

  let baseColorString = config.baseColors[targetRole] || primaryColorString;
  if (config.customColors) {
    const customColor = config.customColors.find(
      (color) => color.role === targetRole,
    );
    if (customColor) {
      baseColorString = customColor.color;
    }
  }
  if (!baseColorString) {
    throw new Error(`Color for role ${targetRole} is not defined.`);
  }

  const [, , baseH] = fromCssString(baseColorString);
  let targetC: number;
  let targetH: number;

  switch (targetRole) {
    case "primary":
      targetC = 0.12;
      targetH = baseH;
      break;
    case "secondary":
      targetC = 0.04;
      targetH = baseH;
      break;
    case "tertiary":
      targetC = 0.12;
      targetH = (baseH + 60) % 360;
      break;
    case "neutral":
      targetC = 0.0;
      targetH = baseH;
      break;
    case "neutralVariant":
      targetC = 0.015;
      targetH = baseH;
      break;
    case "error":
      targetC = 0.15;
      targetH = baseH % 360 || 60;
      break;
    case "custom":
      targetC = 0.12;
      targetH = baseH;
      break;
    default:
      throw new Error(`Invalid color role: ${targetRole}`);
  }

  return [shade, targetC, targetH];
};

// PALETTE_SHADESから固定明度パレットを生成
export const generatePalette = (
  config: ColorSchemeConfig,
  role: ColorRole,
  algorithm: ColorAlgorithm,
): ColorPalette => {
  const shades: Record<number, string> = {};
  PALETTE_SHADES.forEach((shade: number) => {
    shades[shade] = toCssString(algorithm(config, role, shade));
  });
  return { name: role, shades };
};

// ロールごとのカラーを生成
export const generateRoles = (
  config: ColorSchemeConfig,
  roleConfig: {
    name: string;
    role: ColorRole;
    lightShade: number;
    darkShade: number;
  }[],
  algorithm: ColorAlgorithm,
): Record<ColorRole | string, { light: OklchColor; dark: OklchColor }> => {
  return roleConfig.reduce(
    (roles, { name, role, lightShade, darkShade }) => {
      roles[name] = {
        light: algorithm(config, role as ColorRole, lightShade),
        dark: algorithm(config, role as ColorRole, darkShade),
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
export const generateColorSchemeFromConfig = (
  config: ColorSchemeConfig,
  algorithm: ColorAlgorithm = defaultAlgorithm,
): ColorScheme => {
  if (!isValidColorSchemeConfig(config)) {
    throw new Error("Invalid color scheme config.");
  }

  const definedRoles = generateRoles(config, DEFINED_COLOR_ROLES, algorithm);
  const aliasRoles = config.aliasColors
    ? generateRoles(config, config.aliasColors, algorithm)
    : {};

  const customPalettes: Record<string, ColorPalette> = {};
  const customRoles: Record<string, { light: OklchColor; dark: OklchColor }> =
    {};

  config.customColors?.forEach(({ name, role }) => {
    customPalettes[name] = generatePalette(config, role, algorithm);

    const customColorRoleConfigs = [
      { variant: "", lightShade: 0.48, darkShade: 0.8 },
      { variant: `${name}Container`, lightShade: 0.92, darkShade: 0.4 },
      { variant: `${name}On`, lightShade: 1, darkShade: 0.32 },
      { variant: `${name}OnContainer`, lightShade: 0.24, darkShade: 0.92 },
    ];

    customColorRoleConfigs.forEach(({ variant, lightShade, darkShade }) => {
      const roleName = variant || name;
      customRoles[roleName] = {
        light: algorithm(config, role, lightShade),
        dark: algorithm(config, role, darkShade),
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
): Record<string, string> => {
  const toKebabCase = (str: string) => {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  };

  return Object.entries(colorScheme.roles).reduce(
    (cssVars, [key, value]) => {
      cssVars[`--scheme-color-${toKebabCase(key)}-light`] = toCssString(
        value.light,
        "oklch",
      );
      cssVars[`--scheme-color-${toKebabCase(key)}-dark`] = toCssString(
        value.dark,
        "oklch",
      );
      return cssVars;
    },
    {} as Record<string, string>,
  );
};
