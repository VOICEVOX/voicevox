import {
  ColorRole,
  OklchColor,
  ColorPalette,
  ColorAlgorithm,
  ColorSchemeConfig,
} from "@/sing/colorScheme/types";

import { PALETTE_SHADES } from "@/sing/colorScheme/constants";

/**
 * 指定されたベースカラーとロールに基づいてカラーパレットを生成
 * @param sourceColor : OklchColor - 基準となるOKLCHカラー
 * @param role : ColorRole | string - カラーロール
 * @param algorithm : ColorAlgorithm - 使用するカラー生成アルゴリズム
 * @param config : ColorSchemeConfig - カラースキーム設定
 * @returns ColorPalette - 生成されたカラーパレット
 */
export const generatePalette = (
  sourceColor: OklchColor,
  role: ColorRole | string,
  algorithm: ColorAlgorithm,
  config: ColorSchemeConfig,
): ColorPalette => {
  const shades: Record<number, OklchColor> = {};

  PALETTE_SHADES.forEach((shade) => {
    shades[shade] = algorithm(config, sourceColor, role, shade);
  });

  return {
    name: role,
    shades,
  };
};

/**
 * 複数のロールに対してカラーパレットを生成
 * @param roleColors : Record<ColorRole | string, OklchColor> - ロールごとのベースカラー
 * @param algorithm : ColorAlgorithm - 使用するカラー生成アルゴリズム
 * @param config : ColorSchemeConfig - カラースキーム設定
 * @returns Record<ColorRole | string, ColorPalette> - 生成されたカラーパレットのマップ
 */
export const generatePalettesFromRoleColors = (
  roleColors: Record<ColorRole | string, OklchColor>,
  algorithm: ColorAlgorithm,
  config: ColorSchemeConfig,
): Record<ColorRole | string, ColorPalette> => {
  const palettes: Record<ColorRole | string, ColorPalette> = {};

  Object.entries(roleColors).forEach(([role, color]) => {
    palettes[role] = generatePalette(color, role, algorithm, config);
  });

  return palettes;
};
