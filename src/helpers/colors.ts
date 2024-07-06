import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
  Theme,
  Scheme,
  TonalPalette,
  Hct,
  CustomColorGroup,
} from "@material/material-color-utilities";

type ColorAdjustment = Partial<{ hue: number; chroma: number; tone: number }>;
type PaletteAdjustments = Partial<
  Record<keyof Theme["palettes"], ColorAdjustment>
>;
type CustomPaletteColor = {
  name: string;
  palette: keyof Theme["palettes"];
  lightTone: number;
  darkTone: number;
  blend: boolean;
};
type CustomDefinedColor = {
  name: string;
  value: string;
  blend: boolean;
};

export function generateTheme(
  sourceColor: string,
  adjustments: PaletteAdjustments = {},
  customPaletteColors: CustomPaletteColor[] = [],
  customDefinedColors: CustomDefinedColor[] = [],
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
  const customColorGroups: CustomColorGroup[] = [
    ...customPaletteColors.map((color) => {
      const lightColor = adjustedPalettes[color.palette].tone(color.lightTone);
      const darkColor = adjustedPalettes[color.palette].tone(color.darkTone);
      return {
        color: {
          name: color.name,
          value: lightColor,
          blend: color.blend,
        },
        value: lightColor,
        blend: color.blend,
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
    }),
    ...customDefinedColors.map((color) => {
      const colorValue = argbFromHex(color.value);
      return {
        color: {
          name: color.name,
          value: colorValue,
          blend: color.blend,
        },
        value: colorValue,
        blend: color.blend,
        light: {
          color: colorValue,
          onColor: 0,
          colorContainer: 0,
          onColorContainer: 0,
        },
        dark: {
          color: colorValue,
          onColor: 0,
          colorContainer: 0,
          onColorContainer: 0,
        },
      };
    }),
  ];

  // 調整されたパレットを使用して新しいスキームを生成
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

  // すべての標準カラーロールを設定
  Object.entries(scheme.toJSON()).forEach(([colorName, color]) => {
    const kebabCaseName = colorName
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase();
    vars[`--md-sys-color-${kebabCaseName}`] = hexFromArgb(color);
  });

  // 追加のカラーバリアントを生成
  const colorRoles = ["primary", "secondary", "tertiary", "error"] as const;
  colorRoles.forEach((role) => {
    const palette = theme.palettes[role];

    // Fixed, Fixed Dim, On Fixed, On Fixed Variant
    vars[`--md-sys-color-${role}-fixed`] = hexFromArgb(palette.tone(90));
    vars[`--md-sys-color-${role}-fixed-dim`] = hexFromArgb(palette.tone(80));
    vars[`--md-sys-color-on-${role}-fixed`] = hexFromArgb(palette.tone(10));
    vars[`--md-sys-color-on-${role}-fixed-variant`] = hexFromArgb(
      palette.tone(30),
    );
  });

  // Surface Variants
  const neutralPalette = theme.palettes.neutral;
  vars["--md-sys-color-surface-dim"] = hexFromArgb(
    neutralPalette.tone(isDark ? 6 : 87),
  );
  vars["--md-sys-color-surface-bright"] = hexFromArgb(
    neutralPalette.tone(isDark ? 24 : 98),
  );

  // Surface Container
  const containerTones = isDark
    ? { lowest: 4, low: 10, medium: 12, high: 17, highest: 22 }
    : { lowest: 100, low: 96, medium: 94, high: 92, highest: 90 };

  Object.entries(containerTones).forEach(([variant, tone]) => {
    vars[`--md-sys-color-surface-container-${variant}`] = hexFromArgb(
      neutralPalette.tone(tone),
    );
  });

  // Inverse
  vars["--md-sys-color-inverse-surface"] = hexFromArgb(
    neutralPalette.tone(isDark ? 90 : 20),
  );
  vars["--md-sys-color-inverse-on-surface"] = hexFromArgb(
    neutralPalette.tone(isDark ? 20 : 95),
  );
  vars["--md-sys-color-inverse-primary"] = hexFromArgb(
    theme.palettes.primary.tone(isDark ? 40 : 80),
  );

  // Outline
  vars["--md-sys-color-outline"] = hexFromArgb(
    theme.palettes.neutralVariant.tone(isDark ? 60 : 50),
  );
  vars["--md-sys-color-outline-variant"] = hexFromArgb(
    theme.palettes.neutralVariant.tone(isDark ? 30 : 80),
  );

  // Scrim, Shadow
  vars["--md-sys-color-scrim"] = hexFromArgb(neutralPalette.tone(0));
  vars["--md-sys-color-shadow"] = hexFromArgb(neutralPalette.tone(0));

  // refパレット
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

  // カスタムカラーを設定
  theme.customColors.forEach((customColor) => {
    const color = isDark ? customColor.dark.color : customColor.light.color;
    vars[`--md-custom-color-${customColor.color.name}`] = hexFromArgb(color);
  });

  return vars;
}
