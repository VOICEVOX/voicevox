import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
  Theme,
  Scheme,
  TonalPalette,
  CustomColorGroup,
  Hct,
} from "@material/material-color-utilities";

type ColorAdjustment = Partial<{ hue: number; chroma: number; tone: number }>;
type PaletteAdjustments = Partial<
  Record<keyof Theme["palettes"], ColorAdjustment>
>;
type CustomColor = {
  name: string;
  palette: keyof Theme["palettes"];
  lightTone: number;
  darkTone: number;
  blend: boolean;
};

export function generateTheme(
  sourceColor: string,
  adjustments: PaletteAdjustments = {},
  customColors: CustomColor[] = [],
): Theme {
  let theme = themeFromSourceColor(argbFromHex(sourceColor));

  // パレットの調整
  const adjustedPalettes: Record<keyof Theme["palettes"], TonalPalette> = {
    ...theme.palettes,
  };
  for (const [key, adjustment] of Object.entries(adjustments)) {
    if (key in adjustedPalettes && adjustment) {
      const palette = adjustedPalettes[key as keyof Theme["palettes"]];
      const keyHct = Hct.fromInt(palette.keyColor.toInt());
      const newHue = adjustment.hue ?? keyHct.hue;
      const newChroma = adjustment.chroma ?? keyHct.chroma;
      adjustedPalettes[key as keyof Theme["palettes"]] =
        TonalPalette.fromHueAndChroma(newHue, newChroma);
    }
  }

  // カスタムカラーの処理
  const customColorGroups: CustomColorGroup[] = customColors.map((color) => {
    const lightColor = adjustedPalettes[color.palette].tone(color.lightTone);
    const darkColor = adjustedPalettes[color.palette].tone(color.darkTone);
    return {
      name: color.name,
      value: lightColor, // デフォルト値として明るい方の色を使用
      blend: color.blend,
      color: {
        name: color.name,
        value: lightColor,
        blend: color.blend,
      },
      light: {
        color: lightColor,
        onColor: 0,
        colorContainer: 0,
        onColorContainer: 0,
      },
      dark: {
        color: darkColor,
        onColor: 0,
        colorContainer: 0,
        onColorContainer: 0,
      },
    };
  });

  // パレットに基づいて新しいスキームを生成
  const lightScheme = Scheme.light(adjustedPalettes.primary.keyColor.toInt());
  const darkScheme = Scheme.dark(adjustedPalettes.primary.keyColor.toInt());

  // スキームに基づいてカスタムカラーを更新
  customColorGroups.forEach((group) => {
    group.light.onColor = lightScheme.onPrimary;
    group.light.colorContainer = lightScheme.primaryContainer;
    group.light.onColorContainer = lightScheme.onPrimaryContainer;
    group.dark.onColor = darkScheme.onPrimary;
    group.dark.colorContainer = darkScheme.primaryContainer;
    group.dark.onColorContainer = darkScheme.onPrimaryContainer;
  });

  // 調整されたパレット、スキーム、カスタムカラーを使用して新しいテーマを作成
  theme = {
    ...theme,
    palettes: adjustedPalettes,
    schemes: {
      light: lightScheme,
      dark: darkScheme,
    },
    customColors: customColorGroups,
  };

  return theme;
}

export function themeToCssVariables(
  theme: Theme,
  isDark: boolean,
): Record<string, string> {
  const vars: Record<string, string> = {};

  const scheme = isDark ? theme.schemes.dark : theme.schemes.light;

  // Set sys colors
  Object.entries(scheme.toJSON()).forEach(([colorName, color]) => {
    const kebabCasePaletteName = colorName
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase();
    vars[`--md-sys-color-${kebabCasePaletteName}`] = hexFromArgb(color);
  });

  // 追加のカラーバリアントの生成と設定
  const colorRoles = [
    "primary",
    "secondary",
    "tertiary",
    "neutral",
    "neutralVariant",
    "error",
  ] as const;
  colorRoles.forEach((role) => {
    const palette = theme.palettes[role];

    // dim, bright バリアントの生成
    const dimTone = isDark ? 6 : 87;
    const brightTone = isDark ? 24 : 98;
    vars[`--md-sys-color-${role}-dim`] = hexFromArgb(palette.tone(dimTone));
    vars[`--md-sys-color-${role}-bright`] = hexFromArgb(
      palette.tone(brightTone),
    );
  });

  // Set ref palette
  for (const [paletteName, palette] of Object.entries(theme.palettes)) {
    const tones = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];
    for (const tone of tones) {
      const kebabCasePaletteName = paletteName
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .toLowerCase();
      vars[`--md-ref-palette-${kebabCasePaletteName}-${tone}`] = hexFromArgb(
        palette.tone(tone),
      );
    }
  }

  // Set custom colors
  theme.customColors.forEach((customColor) => {
    const color = isDark ? customColor.dark.color : customColor.light.color;
    vars[`--md-custom-color-${customColor.color.name}`] = hexFromArgb(color);
  });

  return vars;
}
