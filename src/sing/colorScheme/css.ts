import { ColorScheme, OklchColor } from "@/sing/colorScheme/types";
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
    withRoles?: boolean; // ロールカラーをCSS変数に含めるか
    withPalette?: boolean; // パレットをCSS変数に含めるか
    withFallback?: boolean; // フォールバック値を含めるか
    prefix?: string; // CSS変数プレフィックス
  } = {},
): {
  light: Record<string, string>;
  dark: Record<string, string>;
  palette: Record<string, string>;
} => {
  const {
    withRoles = true,
    withPalette = false,
    withFallback = false,
    prefix = "--scheme-color-",
  } = options;

  const formatColorVariable = (
    keyName: string,
    color: OklchColor,
  ): [string, string] => {
    const key = `${prefix}${keyName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
    const oklchValue = oklchToCssString(color, "oklch");
    const fallbackValue = oklchToCssString(color, "hex");
    const value = withFallback ? `${oklchValue}, ${fallbackValue}` : oklchValue;
    return [key, value];
  };

  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  const palette: Record<string, string> = {};

  // ロールカラー
  if (withRoles) {
    Object.entries(colorScheme.roles).forEach(([roleName, value]) => {
      const [lightKey, lightValue] = formatColorVariable(
        roleName,
        value.lightShade,
      );
      const [darkKey, darkValue] = formatColorVariable(
        roleName,
        value.darkShade,
      );
      light[lightKey] = lightValue;
      dark[darkKey] = darkValue;
    });
  }

  // パレット
  if (withPalette) {
    Object.entries(colorScheme.palettes).forEach(
      ([paletteName, paletteValue]) => {
        Object.entries(paletteValue.shades).forEach(([shade, color]) => {
          const shadeName = Math.round(Number(shade) * 100);
          const [key, value] = formatColorVariable(
            `${paletteName}-palette-${shadeName}`,
            color,
          );
          palette[key] = value;
        });
      },
    );
  }

  return { light, dark, palette };
};
