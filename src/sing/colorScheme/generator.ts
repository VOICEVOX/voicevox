import Color from "colorjs.io";
import {
  OklchColor,
  CSSColorString,
  ColorRole,
  ColorSchemeConfig,
  ColorScheme,
  ColorPalette,
  ColorAlgorithm,
} from "./types";
import { DEFINED_COLOR_ROLES, PALETTE_SHADES } from "./constants";

// CSSカラー文字列をOKLCH配列に変換する関数
export const oklchFromCssString = (colorString: CSSColorString): OklchColor => {
  const color = new Color(colorString).to("oklch");
  return [color.l, color.c, color.h];
};

export const cssStringFromOklch = (
  oklchColor: OklchColor,
  format: "oklch" | "hex" | "rgb" | "p3" = "oklch",
): CSSColorString => {
  const color = new Color("oklch", [...oklchColor]);
  return color.to(format === "oklch" ? "oklch" : "srgb").toString({ format });
};

const LrFromL = (L: number) => {
  const k1 = 0.206;
  const k2 = 0.03;
  const k3 = (1 + k2) / (1 + k1);

  const l = L;
  const Lr =
    (k3 * l - k2 + Math.sqrt((k3 * l - k2) ** 2 + 4 * k1 * k3 * l)) / 2;
  return Lr;
};

// デフォルトのアルゴリズム
export const defaultAlgorithm: ColorAlgorithm = (
  config: ColorSchemeConfig,
  baseColor: OklchColor,
  targetRole: ColorRole,
  shade: number,
): OklchColor => {
  const targetL = LrFromL(shade);
  let targetC: number;
  let targetH: number;
  const maxC = 0.2;

  if (targetRole === "primary") {
    const [, , primaryH] = baseColor;
    const primaryC = Math.max(0.115, baseColor[1]);
    return [targetL, primaryC, primaryH];
  }

  // カスタムカラーの場合
  const customColor = config.customColors?.find((cc) => cc.name === targetRole);
  if (customColor) {
    const [, customC, customH] = oklchFromCssString(customColor.color);
    const targetC = Math.min(customC, maxC);
    return [targetL, targetC, customH];
  }

  // 指定された色がある場合は、そのchromaとhueを使用する
  if (config.baseColors[targetRole]) {
    const [, userC, userH] = oklchFromCssString(
      config.baseColors[targetRole] as string,
    );
    targetC = Math.min(userC, maxC);
    return [targetL, targetC, userH];
  }

  // 指定がない場合はデフォルト値を使用
  const [, baseC, baseH] = baseColor;
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
      targetH = (baseH - 60 + 360) % 360;
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

// パレットの生成関数
function generatePalette(
  config: ColorSchemeConfig,
  baseColor: OklchColor,
  role: ColorRole,
  algorithm: ColorAlgorithm,
): ColorPalette {
  const shades = PALETTE_SHADES.reduce(
    (acc, shade) => {
      acc[shade] = algorithm(config, baseColor, role, shade);
      return acc;
    },
    {} as Record<number, OklchColor>,
  );

  return { name: role, shades };
}

// ロールカラーの生成関数を更新
function generateRoleColors(
  config: ColorSchemeConfig,
  algorithm: ColorAlgorithm,
): Record<string, { light: OklchColor; dark: OklchColor }> {
  return DEFINED_COLOR_ROLES.reduce(
    (acc, { name, role, lightShade, darkShade }) => {
      const baseColor = getBaseColorForRole(config, role);
      acc[name] = {
        light: algorithm(config, baseColor, role, lightShade),
        dark: algorithm(config, baseColor, role, darkShade),
      };
      return acc;
    },
    {} as Record<string, { light: OklchColor; dark: OklchColor }>,
  );
}

// エイリアスカラーの生成関数を更新
function generateAliasColors(
  config: ColorSchemeConfig,
  algorithm: ColorAlgorithm,
): Record<string, { light: OklchColor; dark: OklchColor }> {
  return (
    config.aliasColors?.reduce(
      (acc, { name, role, lightShade, darkShade }) => {
        const baseColor = getBaseColorForRole(config, role);
        acc[name] = {
          light: algorithm(config, baseColor, role, lightShade),
          dark: algorithm(config, baseColor, role, darkShade),
        };
        return acc;
      },
      {} as Record<string, { light: OklchColor; dark: OklchColor }>,
    ) || {}
  );
}

// カスタムロールカラーの生成関数を更新
function generateCustomRoleColors(
  config: ColorSchemeConfig,
  algorithm: ColorAlgorithm,
): Record<string, { light: OklchColor; dark: OklchColor }> {
  return (
    config.customColors?.reduce(
      (acc, customColor) => {
        if (customColor.asRole) {
          const baseColor = oklchFromCssString(customColor.color);
          acc[customColor.name] = {
            light: algorithm(config, baseColor, customColor.name, 0.8),
            dark: algorithm(config, baseColor, customColor.name, 0.2),
          };
        }
        return acc;
      },
      {} as Record<string, { light: OklchColor; dark: OklchColor }>,
    ) || {}
  );
}

// ベースカラー取得関数を追加
function getBaseColorForRole(
  config: ColorSchemeConfig,
  role: ColorRole,
): OklchColor {
  if (config.baseColors[role]) {
    return oklchFromCssString(config.baseColors[role] as string);
  }
  if (config.customColors?.some((cc) => cc.name === role && cc.asRole)) {
    const customColor = config.customColors.find(
      (cc) => cc.name === role && cc.asRole,
    );
    return oklchFromCssString(customColor!.color);
  }
  return oklchFromCssString(config.baseColors.primary as string);
}

// メインのカラースキーム生成関数
export function generateColorSchemeFromConfig(
  config: ColorSchemeConfig,
  algorithm: ColorAlgorithm = defaultAlgorithm,
): ColorScheme {
  if (!config.baseColors.primary) {
    throw new Error("baseColors.primary is required");
  }

  const primaryBaseColor = oklchFromCssString(config.baseColors.primary);

  const getBaseColorForRole = (role: ColorRole): OklchColor => {
    if (config.baseColors[role]) {
      return oklchFromCssString(config.baseColors[role] as string);
    }
    if (config.customColors?.some((cc) => cc.name === role && cc.asRole)) {
      const customColor = config.customColors.find(
        (cc) => cc.name === role && cc.asRole,
      );
      return oklchFromCssString(customColor!.color);
    }
    return primaryBaseColor;
  };

  const palettes: Record<ColorRole, ColorPalette> = {
    primary: generatePalette(
      config,
      getBaseColorForRole("primary"),
      "primary",
      algorithm,
    ),
    secondary: generatePalette(
      config,
      getBaseColorForRole("secondary"),
      "secondary",
      algorithm,
    ),
    tertiary: generatePalette(
      config,
      getBaseColorForRole("tertiary"),
      "tertiary",
      algorithm,
    ),
    neutral: generatePalette(
      config,
      getBaseColorForRole("neutral"),
      "neutral",
      algorithm,
    ),
    neutralVariant: generatePalette(
      config,
      getBaseColorForRole("neutralVariant"),
      "neutralVariant",
      algorithm,
    ),
    error: generatePalette(
      config,
      getBaseColorForRole("error"),
      "error",
      algorithm,
    ),
  };

  // カスタムカラーのパレット生成
  config.customColors?.forEach((customColor) => {
    if (customColor.asRole) {
      const customBaseColor = oklchFromCssString(customColor.color);
      palettes[customColor.name] = generatePalette(
        config,
        customBaseColor,
        customColor.name,
        algorithm,
      );
    }
  });

  const definedRoles = generateRoleColors(config, algorithm);
  const aliasRoles = generateAliasColors(config, algorithm);
  const customRoles = generateCustomRoleColors(config, algorithm);

  const roles = { ...definedRoles, ...aliasRoles, ...customRoles };

  return {
    name: config.name,
    displayName: config.displayName,
    palettes,
    roles,
    config,
  };
}

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
      cssVars[`${prefix}${toKebabCase(key)}-light`] = cssStringFromOklch(
        value.light,
        "oklch",
      );
      cssVars[`${prefix}${toKebabCase(key)}-dark`] = cssStringFromOklch(
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
              ] = cssStringFromOklch(color, "oklch");
            });
          },
        );
      }
      return cssVars;
    },
    {} as Record<string, string>,
  );
};
