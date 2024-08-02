import { ColorScheme } from "@/sing/colorScheme/types";
import { oklchToCssString } from "@/sing/colorScheme/util";

/**
 * カラースキームからCSS変数を生成する
 * @param colorScheme: ColorScheme : カラースキーム
 * @param withRoles: boolean : ロールを出力に含めるか
 * @param withPalette: boolean : パレットを出力に含めるか
 * @param prefix: string : 接頭辞 eg: primary -> --scheme-color-primary
 * @returns Record<string, string> : CSS変数名をキーとして、CSS値を値とするオブジェクト
 */
export const cssVariablesFromColorScheme = (
  colorScheme: ColorScheme,
  withRoles: boolean = true,
  withPalette: boolean = false,
  prefix: string = "--scheme-color-",
): Record<string, string> => {
  const toKebabCase = (str: string) => {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  };

  const cssVars = {} as Record<string, string>;
  if (withRoles) {
    Object.entries(colorScheme.roles).forEach(
      ([roleName, value]) => {
        cssVars[`${prefix}${toKebabCase(roleName)}-light`] = oklchToCssString(
          value.lightShade,
          "oklch",
        );
        cssVars[`${prefix}${toKebabCase(roleName)}-dark`] = oklchToCssString(
          value.darkShade,
          "oklch",
        );
      },
      {} as Record<string, string>,
    );
  }

  if (withPalette) {
    Object.entries(colorScheme.palettes).forEach(([paletteName, palette]) => {
      Object.entries(palette.shades).forEach(([shade, color]) => {
        const shadeName = Number(shade) * 100;
        cssVars[`${prefix}${toKebabCase(paletteName)}-palette-${shadeName}`] =
          oklchToCssString(color, "oklch");
      });
    });
  }

  return cssVars;
};
