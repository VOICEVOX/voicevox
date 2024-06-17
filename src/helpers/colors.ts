import {
  CorePalette,
  TonalPalette,
  argbFromHex,
  Hct,
} from "@material/material-color-utilities";

export interface ColorConfig {
  sourceColor: string;
  neutralHue?: number;
  light: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
    error?: string;
  };
  dark: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
    error?: string;
  };
  customColors: {
    [key: string]: string;
  };
  tones: {
    primary?: number;
    secondary?: number;
    tertiary?: number;
    neutral?: number;
    neutralVariant?: number;
    error?: number;
  };
}

export function generateColorPalette(config: ColorConfig) {
  const sourceArgb = argbFromHex(config.sourceColor);

  // ニュートラルカラーの色相 (デフォルトは 180)
  const neutralHue = config.neutralHue ?? 180;

  // neutral, neutralVariant の TonalPalette を生成 (light/dark に依存しない)
  const neutralPalette = TonalPalette.fromHct(Hct.from(neutralHue, 0, 99));
  const neutralVariantPalette = TonalPalette.fromHct(
    Hct.from(neutralHue, 0, 90),
  );

  // primaryカラーが指定されている場合は、それをsource colorとしてCorePaletteを生成
  const lightCorePalette = config.light.primary
    ? CorePalette.of(argbFromHex(config.light.primary))
    : CorePalette.of(sourceArgb);
  const darkCorePalette = config.dark.primary
    ? CorePalette.of(argbFromHex(config.dark.primary))
    : CorePalette.of(sourceArgb);

  // ライトテーマのカラーパレット生成
  const lightPrimaryHct = Hct.fromInt(lightCorePalette.a1.tone(40));
  const lightSecondaryHct = config.light.secondary
    ? Hct.fromInt(argbFromHex(config.light.secondary))
    : Hct.fromInt(lightCorePalette.a2.tone(40)); // CorePalette から取得
  const lightTertiaryHct = config.light.tertiary
    ? Hct.fromInt(argbFromHex(config.light.tertiary))
    : Hct.fromInt(lightCorePalette.a3.tone(40)); // CorePalette から取得
  const lightErrorHct = config.light.error
    ? Hct.fromInt(argbFromHex(config.light.error))
    : Hct.from(25, 84, 40);

  // ダークテーマのカラーパレット生成 (lightテーマと同様)
  const darkPrimaryHct = Hct.fromInt(darkCorePalette.a1.tone(40));
  const darkSecondaryHct = config.dark.secondary
    ? Hct.fromInt(argbFromHex(config.dark.secondary))
    : Hct.fromInt(darkCorePalette.a2.tone(40));
  const darkTertiaryHct = config.dark.tertiary
    ? Hct.fromInt(argbFromHex(config.dark.tertiary))
    : Hct.fromInt(darkCorePalette.a3.tone(40));
  const darkErrorHct = config.dark.error
    ? Hct.fromInt(argbFromHex(config.dark.error))
    : Hct.from(25, 84, 80);

  // TonalPalette を生成
  const lightPrimaryPalette = TonalPalette.fromHct(lightPrimaryHct);
  const lightSecondaryPalette = TonalPalette.fromHct(lightSecondaryHct);
  const lightTertiaryPalette = TonalPalette.fromHct(lightTertiaryHct);
  const lightErrorPalette = TonalPalette.fromHct(lightErrorHct);

  const darkPrimaryPalette = TonalPalette.fromHct(darkPrimaryHct);
  const darkSecondaryPalette = TonalPalette.fromHct(darkSecondaryHct);
  const darkTertiaryPalette = TonalPalette.fromHct(darkTertiaryHct);
  const darkErrorPalette = TonalPalette.fromHct(darkErrorHct);

  // カスタムカラー
  const customColors = Object.entries(config.customColors).reduce<{
    [key: string]: number;
  }>((acc, [key, value]) => {
    acc[key] = argbFromHex(value);
    return acc;
  }, {});

  // Light Scheme
  const lightScheme = {
    primary: lightPrimaryPalette.tone(40),
    onPrimary: lightPrimaryPalette.tone(100),
    primaryContainer: lightPrimaryPalette.tone(90),
    onPrimaryContainer: lightPrimaryPalette.tone(10),
    secondary: lightSecondaryPalette.tone(40),
    onSecondary: lightSecondaryPalette.tone(100),
    secondaryContainer: lightSecondaryPalette.tone(90),
    onSecondaryContainer: lightSecondaryPalette.tone(10),
    tertiary: lightTertiaryPalette.tone(40),
    onTertiary: lightTertiaryPalette.tone(100),
    tertiaryContainer: lightTertiaryPalette.tone(90),
    onTertiaryContainer: lightTertiaryPalette.tone(10),
    error: lightErrorPalette.tone(40),
    onError: lightErrorPalette.tone(100),
    errorContainer: lightErrorPalette.tone(90),
    onErrorContainer: lightErrorPalette.tone(10),
    background: neutralPalette.tone(100), // neutralPalette を使用
    onBackground: neutralPalette.tone(10), // neutralPalette を使用
    surface: neutralPalette.tone(99), // neutralPalette を使用
    onSurface: neutralPalette.tone(10), // neutralPalette を使用
    surfaceVariant: neutralVariantPalette.tone(95), // neutralVariantPalette を使用
    onSurfaceVariant: neutralVariantPalette.tone(30), // neutralVariantPalette を使用
    outline: neutralVariantPalette.tone(50), // neutralVariantPalette を使用
    outlineVariant: neutralVariantPalette.tone(80), // neutralVariantPalette を使用
    shadow: neutralPalette.tone(0), // neutralPalette を使用
    scrim: neutralPalette.tone(0), // neutralPalette を使用
    inverseSurface: neutralPalette.tone(20), // neutralPalette を使用
    inverseOnSurface: neutralPalette.tone(95), // neutralPalette を使用
    inversePrimary: lightPrimaryPalette.tone(80),

    // Surface container
    surfaceContainerLowest: neutralVariantPalette.tone(90), // neutralVariantPalette を使用
    surfaceContainerLow: neutralVariantPalette.tone(80), // neutralVariantPalette を使用
    surfaceContainer: neutralVariantPalette.tone(70), // neutralVariantPalette を使用
    surfaceContainerHigh: neutralVariantPalette.tone(60), // neutralVariantPalette を使用
    surfaceContainerHighest: neutralVariantPalette.tone(50), // neutralVariantPalette を使用

    // Fixed Colors
    surfaceTint: lightPrimaryPalette.tone(40),
    primaryFixed: lightPrimaryPalette.tone(90),
    onPrimaryFixed: lightPrimaryPalette.tone(10),
    primaryFixedDim: lightPrimaryPalette.tone(70),
    secondaryFixed: lightSecondaryPalette.tone(90),
    onSecondaryFixed: lightSecondaryPalette.tone(10),
    secondaryFixedDim: lightSecondaryPalette.tone(70),
    tertiaryFixed: lightTertiaryPalette.tone(90),
    onTertiaryFixed: lightTertiaryPalette.tone(10),
    tertiaryFixedDim: lightTertiaryPalette.tone(70),
  };

  // Dark Scheme
  const darkScheme = {
    primary: darkPrimaryPalette.tone(80),
    onPrimary: darkPrimaryPalette.tone(20),
    primaryContainer: darkPrimaryPalette.tone(30),
    onPrimaryContainer: darkPrimaryPalette.tone(90),
    secondary: darkSecondaryPalette.tone(80),
    onSecondary: darkSecondaryPalette.tone(20),
    secondaryContainer: darkSecondaryPalette.tone(30),
    onSecondaryContainer: darkSecondaryPalette.tone(90),
    tertiary: darkTertiaryPalette.tone(80),
    onTertiary: darkTertiaryPalette.tone(20),
    tertiaryContainer: darkTertiaryPalette.tone(30),
    onTertiaryContainer: darkTertiaryPalette.tone(90),
    error: darkErrorPalette.tone(80),
    onError: darkErrorPalette.tone(20),
    errorContainer: darkErrorPalette.tone(30),
    onErrorContainer: darkErrorPalette.tone(90),
    background: neutralPalette.tone(10), // neutralPalette を使用
    onBackground: neutralPalette.tone(90), // neutralPalette を使用
    surface: neutralPalette.tone(10), // neutralPalette を使用
    onSurface: neutralPalette.tone(90), // neutralPalette を使用
    surfaceVariant: neutralVariantPalette.tone(30), // neutralVariantPalette を使用
    onSurfaceVariant: neutralVariantPalette.tone(80), // neutralVariantPalette を使用
    outline: neutralVariantPalette.tone(60), // neutralVariantPalette を使用
    outlineVariant: neutralVariantPalette.tone(30), // neutralVariantPalette を使用
    shadow: neutralPalette.tone(0), // neutralPalette を使用
    scrim: neutralPalette.tone(0), // neutralPalette を使用
    inverseSurface: neutralPalette.tone(90), // neutralPalette を使用
    inverseOnSurface: neutralPalette.tone(20), // neutralPalette を使用
    inversePrimary: darkPrimaryPalette.tone(40),

    // Surface container
    surfaceContainerLowest: neutralVariantPalette.tone(30), // neutralVariantPalette を使用
    surfaceContainerLow: neutralVariantPalette.tone(40), // neutralVariantPalette を使用
    surfaceContainer: neutralVariantPalette.tone(50), // neutralVariantPalette を使用
    surfaceContainerHigh: neutralVariantPalette.tone(60), // neutralVariantPalette を使用
    surfaceContainerHighest: neutralVariantPalette.tone(70), // neutralVariantPalette を使用

    // Fixed Colors
    surfaceTint: darkPrimaryPalette.tone(80),
    primaryFixed: darkPrimaryPalette.tone(40),
    onPrimaryFixed: darkPrimaryPalette.tone(90),
    primaryFixedDim: darkPrimaryPalette.tone(60),
    secondaryFixed: darkSecondaryPalette.tone(40),
    onSecondaryFixed: darkSecondaryPalette.tone(90),
    secondaryFixedDim: darkSecondaryPalette.tone(60),
    tertiaryFixed: darkTertiaryPalette.tone(40),
    onTertiaryFixed: darkTertiaryPalette.tone(90),
    tertiaryFixedDim: darkTertiaryPalette.tone(60),
  };

  return {
    light: {
      ...lightScheme,
      ...customColors,
    },
    dark: {
      ...darkScheme,
      ...customColors,
    },
  };
}

// CSS 変数に設定
export function applyColorPalette(palette: { [key: string]: number }) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(palette)) {
    const kebabCaseKey = key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    root.style.setProperty(
      `--md-sys-color-${kebabCaseKey}`,
      `#${value.toString(16).padStart(8, "0").slice(2)}`,
    );
  }
}

// ライトテーマとダークテーマの切り替え
export function applyTheme(
  colorPalette: {
    light: { [key: string]: number };
    dark: { [key: string]: number };
  },
  isDark: boolean,
) {
  const palette = isDark ? colorPalette.dark : colorPalette.light;
  applyColorPalette(palette);
}
