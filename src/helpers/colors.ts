import {
  CorePalette,
  TonalPalette,
  argbFromHex,
  Hct,
} from "@material/material-color-utilities";

export interface ColorConfig {
  sourceColor: string;
  primaryHue: {
    light: number;
    dark: number;
  };
  secondaryHue: {
    light: number;
    dark: number;
  };
  tertiaryHue: {
    light: number;
    dark: number;
  };
  neutral: {
    light: number;
    dark: number;
  };
  neutralVariant: {
    light: number;
    dark: number;
  };
  customColors: {
    error: string;
    success: string;
  };
}

export function generateColorPalette(config: ColorConfig) {
  const sourceArgb = argbFromHex(config.sourceColor);
  const corePalette = CorePalette.of(sourceArgb);

  // primary, secondary, tertiary の TonalPalette を生成
  const primaryPalette = TonalPalette.fromHueAndChroma(
    config.primaryHue.light,
    corePalette.a1.chroma,
  );
  const secondaryPalette = TonalPalette.fromHueAndChroma(
    config.secondaryHue.light,
    corePalette.a2.chroma,
  );
  const tertiaryPalette = TonalPalette.fromHueAndChroma(
    config.tertiaryHue.light,
    corePalette.a3.chroma,
  );

  // neutral, neutralVariant の TonalPalette を生成
  const neutralPalette = TonalPalette.fromHct(
    Hct.from(corePalette.n1.hue, corePalette.n1.chroma, config.neutral.light),
  );

  const neutralVariantPalette = TonalPalette.fromHct(
    Hct.from(
      corePalette.n2.hue,
      corePalette.n2.chroma,
      config.neutralVariant.light,
    ),
  );

  // カスタムカラー
  const customColors = Object.entries(config.customColors).reduce<{
    [key: string]: number;
  }>((acc, [key, value]) => {
    acc[key] = argbFromHex(value);
    return acc;
  }, {});

  const lightScheme = {
    primary: primaryPalette.tone(40),
    onPrimary: primaryPalette.tone(100),
    primaryContainer: primaryPalette.tone(90),
    onPrimaryContainer: primaryPalette.tone(10),
    secondary: secondaryPalette.tone(40),
    onSecondary: secondaryPalette.tone(100),
    secondaryContainer: secondaryPalette.tone(90),
    onSecondaryContainer: secondaryPalette.tone(10),
    tertiary: tertiaryPalette.tone(40),
    onTertiary: tertiaryPalette.tone(100),
    tertiaryContainer: tertiaryPalette.tone(90),
    onTertiaryContainer: tertiaryPalette.tone(10),
    error: corePalette.error.tone(40),
    onError: corePalette.error.tone(100),
    errorContainer: corePalette.error.tone(90),
    onErrorContainer: corePalette.error.tone(10),
    background: neutralPalette.tone(99),
    onBackground: neutralPalette.tone(10),
    surface: neutralPalette.tone(99),
    onSurface: neutralPalette.tone(10),
    surfaceVariant: neutralVariantPalette.tone(90),
    onSurfaceVariant: neutralVariantPalette.tone(30),
    outline: neutralVariantPalette.tone(50),
    outlineVariant: neutralVariantPalette.tone(80),
    shadow: neutralPalette.tone(0),
    scrim: neutralPalette.tone(0),
    inverseSurface: neutralPalette.tone(20),
    inverseOnSurface: neutralPalette.tone(95),
    inversePrimary: primaryPalette.tone(80),
  };

  const darkScheme = {
    primary: primaryPalette.tone(80),
    onPrimary: primaryPalette.tone(20),
    primaryContainer: primaryPalette.tone(30),
    onPrimaryContainer: primaryPalette.tone(90),
    secondary: secondaryPalette.tone(80),
    onSecondary: secondaryPalette.tone(20),
    secondaryContainer: secondaryPalette.tone(30),
    onSecondaryContainer: secondaryPalette.tone(90),
    tertiary: tertiaryPalette.tone(80),
    onTertiary: tertiaryPalette.tone(20),
    tertiaryContainer: tertiaryPalette.tone(30),
    onTertiaryContainer: tertiaryPalette.tone(90),
    error: corePalette.error.tone(80),
    onError: corePalette.error.tone(20),
    errorContainer: corePalette.error.tone(30),
    onErrorContainer: corePalette.error.tone(90),
    background: neutralPalette.tone(10),
    onBackground: neutralPalette.tone(90),
    surface: neutralPalette.tone(10),
    onSurface: neutralPalette.tone(90),
    surfaceVariant: neutralVariantPalette.tone(30),
    onSurfaceVariant: neutralVariantPalette.tone(80),
    outline: neutralVariantPalette.tone(60),
    outlineVariant: neutralVariantPalette.tone(30),
    shadow: neutralPalette.tone(0),
    scrim: neutralPalette.tone(0),
    inverseSurface: neutralPalette.tone(90),
    inverseOnSurface: neutralPalette.tone(20),
    inversePrimary: primaryPalette.tone(40),
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
