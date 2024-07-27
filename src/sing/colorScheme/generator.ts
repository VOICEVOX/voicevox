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
const ColorUtils = {
  fromCssString: (colorString: string): OklchColor => {
    const color = new Color(colorString).to("oklch");
    return [color.l, color.c, color.h];
  },

  toCssString: (
    oklchColor: OklchColor,
    format: "oklch" | "hex" | "rgb" | "p3" = "oklch",
  ): string => {
    const color = new Color("oklch", [...oklchColor]);
    return color.to(format === "oklch" ? "oklch" : "srgb").toString({ format });
  },

  adjustLightness: (color: OklchColor, delta: number): OklchColor => [
    color[0] + delta,
    color[1],
    color[2],
  ],
};

// カラー生成アルゴリズム
const Algorithms = {
  default: (
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
    // ベースカラーが定義されている場合はそれを使用
    let baseColorString = config.baseColors[targetRole] || primaryColorString;
    // カスタムカラーが定義されている場合はそれを使用(微妙なので実装考えた方が良さそう)
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

    const [, , baseH] = ColorUtils.fromCssString(baseColorString);
    let targetC: number;
    let targetH: number;

    // いろいろアルゴリズムはありそうだが、定数にする
    switch (targetRole) {
      // 彩度 12%
      case "primary":
        targetC = 0.12;
        targetH = baseH;
        break;
      // 彩度 4%
      case "secondary":
        targetC = 0.04;
        targetH = baseH;
        break;
      // 彩度 12% / 色相60度シフト
      case "tertiary":
        targetC = 0.12;
        targetH = (baseH + 60) % 360;
        break;
      // 彩度 0%
      case "neutral":
        targetC = 0.002;
        targetH = baseH;
        break;
      // 彩度 2%
      case "neutralVariant":
        targetC = 0.02;
        targetH = baseH;
        break;
      // 彩度 15%
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
  },
  // NOTE: パステルとかビタミンとかハイコントラストとか一応追加できそう
  // (トーンカーブとか色々必要)
};

// カラースキーム生成
export const ColorSchemeGenerator = {
  // PALETTE_SHADESから固定明度パレットを生成
  generatePalette: (
    config: ColorSchemeConfig,
    role: ColorRole,
    algorithm: ColorAlgorithm,
  ): ColorPalette => {
    const shades: Record<number, string> = {};
    PALETTE_SHADES.forEach((shade: number) => {
      shades[shade] = ColorUtils.toCssString(algorithm(config, role, shade));
    });
    return { name: role, shades };
  },

  // ロールごとのカラーを生成
  generateRoles: (
    config: ColorSchemeConfig,
    roleConfig: {
      name: string;
      role: ColorRole;
      lightShade: number;
      darkShade: number;
    }[],
    algorithm: ColorAlgorithm,
  ): Record<ColorRole | string, { light: OklchColor; dark: OklchColor }> => {
    const roles: Record<string, { light: OklchColor; dark: OklchColor }> = {};
    roleConfig.forEach(({ name, role, lightShade, darkShade }) => {
      roles[name] = {
        light: algorithm(config, role as ColorRole, lightShade),
        dark: algorithm(config, role as ColorRole, darkShade),
      };
    });
    return roles;
  },

  // 設定バリデーション
  isValidConfig: (): boolean => {
    // impl
    return true;
  },

  // 設定からカラースキームを生成
  fromConfig: (
    config: ColorSchemeConfig,
    algorithm: ColorAlgorithm = Algorithms.default,
  ): ColorScheme => {
    // 設定が有効かチェック
    if (!ColorSchemeGenerator.isValidConfig()) {
      throw new Error("Invalid color scheme config.");
    }
    // 標準ロール eg: primary, onPrimary, outline...
    const definedRoles = ColorSchemeGenerator.generateRoles(
      config,
      DEFINED_COLOR_ROLES,
      algorithm,
    );

    // ロールからのエイリアス eg: errorButtonContainer -> errorの明度0.14など
    const aliasRoles = config.aliasColors
      ? ColorSchemeGenerator.generateRoles(
          config,
          config.aliasColors,
          algorithm,
        )
      : {};

    // 定義したカラーから揃ったパレットを生成
    const customPalettes: Record<string, ColorPalette> = {};
    // 定義したカラーから基本ロールを生成 eg: customOrange #ffa726 -> customOrange, customOrangeContainer, customOrangeOn, customOrangeOnContainer...
    const customRoles: Record<string, { light: OklchColor; dark: OklchColor }> =
      {};

    config.customColors?.forEach(({ name, role }) => {
      customPalettes[name] = ColorSchemeGenerator.generatePalette(
        config,
        role,
        algorithm,
      );
      // 標準ロールを追加 定数に切り出す？
      const customColorRoleConfigs = [
        { variant: "", lightShade: 0.48, darkShade: 0.8 },
        { variant: `${name}Container`, lightShade: 0.92, darkShade: 0.4 },
        { variant: `${name}On`, lightShade: 1, darkShade: 0.32 },
        { variant: `${name}OnContainer`, lightShade: 0.24, darkShade: 0.92 },
      ];

      customColorRoleConfigs.forEach(({ variant, lightShade, darkShade }) => {
        const roleName = variant ? variant : name;
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
  },
};

// カラースキームからCSS Variables生成
export const cssVariablesFromColorScheme = (
  colorScheme: ColorScheme,
  // prefix: string = "--md-sys-color-",
  // isExportPalettes: boolean = true,
): Record<string, string> => {
  const cssVars: Record<string, string> = {};

  const toKebabCase = (str: string) => {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  };

  // roles の CSS 変数(prefixは暫定)
  Object.entries(colorScheme.roles).forEach(([key, value]) => {
    cssVars[`--scheme-color-${toKebabCase(key)}-light`] =
      ColorUtils.toCssString(value.light, "oklch");
    cssVars[`--scheme-color-${toKebabCase(key)}-dark`] = ColorUtils.toCssString(
      value.dark,
      "oklch",
    );
  });

  return cssVars;
};
