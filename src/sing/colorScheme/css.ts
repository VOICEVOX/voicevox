import { ColorScheme } from "@/sing/colorScheme/types";
import { oklchToCssString } from "@/sing/colorScheme/util";

/**
 * カラースキームからCSS変数を生成する
 * @param colorScheme カラースキーム
 * @param options 生成オプション
 * @returns ライトモード/ダークモード/パレットのCSS変数
 */
export const cssVariablesFromColorScheme = (
  colorScheme: ColorScheme,
  options: {
    withRoles?: boolean;
    withPalette?: boolean;
    format?: "oklch" | "hex";
    prefix?: string;
  } = {},
): {
  light: Record<string, string>;
  dark: Record<string, string>;
  palette: Record<string, string>;
} => {
  const {
    withRoles = true,
    withPalette = false,
    format = "oklch",
    prefix = "--scheme-color-",
  } = options;

  const toKebabCase = (str: string) =>
    str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  const palette: Record<string, string> = {};

  // ロールカラー
  if (withRoles) {
    Object.entries(colorScheme.roles).forEach(([roleName, value]) => {
      const kebabRoleName = toKebabCase(roleName);
      light[`${prefix}${kebabRoleName}`] = oklchToCssString(
        value.lightShade,
        format,
      );
      dark[`${prefix}${kebabRoleName}`] = oklchToCssString(
        value.darkShade,
        format,
      );
    });
  }

  // パレット
  if (withPalette) {
    Object.entries(colorScheme.palettes).forEach(
      ([paletteName, paletteValue]) => {
        Object.entries(paletteValue.shades).forEach(([shade, color]) => {
          const shadeName = Math.round(Number(shade) * 100);
          const key = `${prefix}${toKebabCase(paletteName)}-palette-${shadeName}`;
          palette[key] = oklchToCssString(color, format);
        });
      },
    );
  }

  return { light, dark, palette };
};
