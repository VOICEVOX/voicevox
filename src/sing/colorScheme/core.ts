import {
  CSSColorString,
  ColorScheme,
  ColorSchemeConfig,
  ColorRole,
  ColorPalette,
  OklchColor,
  ColorShades,
  CustomColorConfig,
  AliasColorConfig,
} from "@/sing/colorScheme/types";
import { generatePalette } from "@/sing/colorScheme/palette";
import { cssStringToOklch } from "@/sing/colorScheme/util";
import { algorithms } from "@/sing/colorScheme/algorithm";
import {
  DEFINED_REF_COLOR_ROLES,
  CUSTOM_COLOR_ROLES,
} from "@/sing/colorScheme/constants";

/**
 * 設定からカラースキームを生成する
 * @param config: ColorSchemeConfig : カラースキーム設定
 * @returns ColorScheme : カラースキーム
 */
export const generateColorSchemeFromConfig = (
  config: ColorSchemeConfig,
): ColorScheme => {
  const roles: Record<ColorRole | string, ColorShades> = {};
  const palettes: Record<ColorRole | string, ColorPalette> = {};
  const algorithm = algorithms[config.algorithmName || "default"];

  // ベースカラーの処理
  DEFINED_REF_COLOR_ROLES.forEach(({ name, role, lightShade, darkShade }) => {
    const sourceColor = getColorForRole(config, role);
    roles[name] = {
      lightShade: algorithm(config, sourceColor, role, lightShade),
      darkShade: algorithm(config, sourceColor, role, darkShade),
    };
    if (!palettes[role]) {
      palettes[role] = generatePalette(sourceColor, role, algorithm, config);
    }
  });

  // カスタムカラーの処理
  config.customColors?.forEach((customColor) => {
    const sourceColor = cssStringToOklch(customColor.sourceColor);
    if (customColor) {
      CUSTOM_COLOR_ROLES.forEach(({ name, role, lightShade, darkShade }) => {
        const roleName = name.replace("${customColorName}", customColor.name);
        roles[roleName] = {
          lightShade: algorithm(config, sourceColor, role, lightShade),
          darkShade: algorithm(config, sourceColor, role, darkShade),
        };
      });
      palettes[customColor.name] = generatePalette(
        sourceColor,
        customColor.name,
        algorithm,
        config,
      );
    }
  });

  // エイリアスカラーの処理
  config.aliasColors?.forEach((aliasColor) => {
    const sourceColor = getColorForRole(config, aliasColor.role);
    roles[aliasColor.name] = {
      lightShade: algorithm(
        config,
        sourceColor,
        aliasColor.role,
        aliasColor.lightShade,
      ),
      darkShade: algorithm(
        config,
        sourceColor,
        aliasColor.role,
        aliasColor.darkShade,
      ),
    };
  });

  return {
    name: config.name,
    displayName: config.displayName,
    roles,
    palettes,
    config,
  };
};

/**
 * ロール名からカラーを取得する
 * @param config: ColorSchemeConfig : カラースキーム設定
 * @param role: ColorRole : ロール
 * @returns OklchColor : カラー
 */
const getColorForRole = (
  config: ColorSchemeConfig,
  role: ColorRole,
): OklchColor => {
  try {
    // ベースロールカラーをチェック
    if (config.roleColors[role]) {
      return cssStringToOklch(config.roleColors[role] as string);
    }
    // カスタムカラーをチェック
    const customColor = config.customColors?.find((cc) => cc.name === role);
    if (customColor) {
      return cssStringToOklch(customColor.sourceColor);
    }
    // エイリアスカラーをチェック
    const aliasColor = config.aliasColors?.find((ac) => ac.name === role);
    if (aliasColor) {
      // エイリアスの参照先を再帰的に取得
      return getColorForRole(config, aliasColor.role);
    }
    // どれにも該当しない場合は、primaryにフォールバック
    return cssStringToOklch(config.roleColors.primary as string);
  } catch (error) {
    throw new Error(`Failed to get color for role: ${role}`);
  }
};

/**
 * カラースキームを更新する
 * @param scheme: ColorScheme : カラースキーム
 * @param updates: Partial<ColorSchemeConfig> : 更新する設定
 * @returns ColorScheme : 更新されたカラースキーム
 */
export const updateColorScheme = (
  scheme: ColorScheme,
  updates: Partial<ColorSchemeConfig>,
): ColorScheme => {
  const updatedConfig = { ...scheme.config, ...updates };
  return generateColorSchemeFromConfig(updatedConfig);
};

/**
 * ロールのカラーを設定する
 * @param scheme: ColorScheme : カラースキーム
 * @param role: ColorRole : ロール
 * @param color: CSSColorString : カラー
 * @returns ColorScheme : 更新されたカラースキーム
 */
export const setRoleColor = (
  scheme: ColorScheme,
  role: ColorRole,
  color: CSSColorString,
): ColorScheme => {
  const updatedRoleColors = { ...scheme.config.roleColors, [role]: color };
  return updateColorScheme(scheme, { roleColors: updatedRoleColors });
};

/**
 * カスタムカラーを追加する
 * @param scheme: ColorScheme : カラースキーム
 * @param customColor: CustomColorConfig : カスタムカラー
 * @returns ColorScheme : 更新されたカラースキーム
 */
export const addCustomColor = (
  scheme: ColorScheme,
  customColor: CustomColorConfig,
): ColorScheme => {
  const updatedCustomColors = [
    ...(scheme.config.customColors || []),
    customColor,
  ];
  return updateColorScheme(scheme, { customColors: updatedCustomColors });
};

/**
 * カスタムカラーを削除する
 * @param scheme: ColorScheme : カラースキーム
 * @param colorName: string : カラー名
 * @returns ColorScheme : 更新されたカラースキーム
 */
export const removeCustomColor = (
  scheme: ColorScheme,
  colorName: string,
): ColorScheme => {
  const updatedCustomColors =
    scheme.config.customColors?.filter((c) => c.name !== colorName) || [];
  return updateColorScheme(scheme, { customColors: updatedCustomColors });
};

/**
 * エイリアスカラーを追加する
 * @param scheme: ColorScheme : カラースキーム
 * @param aliasColor: AliasColorConfig : エイリアスカラー
 * @returns ColorScheme : 更新されたカラースキーム
 */
export const addAliasColor = (
  scheme: ColorScheme,
  aliasColor: AliasColorConfig,
): ColorScheme => {
  const updatedAliasColors = [...(scheme.config.aliasColors || []), aliasColor];
  return updateColorScheme(scheme, { aliasColors: updatedAliasColors });
};

/**
 * エイリアスカラーを削除する
 * @param scheme: ColorScheme : カラースキーム
 * @param colorName: string : カラー名
 * @returns ColorScheme : 更新されたカラースキーム
 */
export const removeAliasColor = (
  scheme: ColorScheme,
  colorName: string,
): ColorScheme => {
  const updatedAliasColors =
    scheme.config.aliasColors?.filter((c) => c.name !== colorName) || [];
  return updateColorScheme(scheme, { aliasColors: updatedAliasColors });
};
