import Color from "colorjs.io";

// ---------------------------------------------------------------------------
//  型定義
// ---------------------------------------------------------------------------

type Lightness = number;
type Chroma = number;
type Hue = number;
export type OklchColor = [Lightness, Chroma, Hue];

export type ColorSpace = "oklch" | "hex" | "p3" | "srgb";

type CSSColorString = string; // ex: "#aaaaaa", "oklch(0.1 0.1 360)", "rgb(255, 0, 0)"

export type CoreColorKey =
  | "primary"
  | "secondary"
  | "tertiary"
  | "neutral"
  | "neutralVariant"
  | "error";

export type ColorRole =
  | "primary"
  | "onPrimary"
  | "primaryContainer"
  | "onPrimaryContainer"
  | "primaryFixed"
  | "primaryFixedDim"
  | "onPrimaryFixed"
  | "onPrimaryFixedVariant"
  | "secondary"
  | "onSecondary"
  | "secondaryContainer"
  | "onSecondaryContainer"
  | "secondaryFixed"
  | "secondaryFixedDim"
  | "onSecondaryFixed"
  | "onSecondaryFixedVariant"
  | "tertiary"
  | "onTertiary"
  | "tertiaryContainer"
  | "onTertiaryContainer"
  | "tertiaryFixed"
  | "tertiaryFixedDim"
  | "onTertiaryFixed"
  | "onTertiaryFixedVariant"
  | "error"
  | "onError"
  | "errorContainer"
  | "onErrorContainer"
  | "background"
  | "onBackground"
  | "surface"
  | "onSurface"
  | "surfaceVariant"
  | "onSurfaceVariant"
  | "outline"
  | "outlineVariant"
  | "shadow"
  | "scrim"
  | "inverseSurface"
  | "inverseOnSurface"
  | "inversePrimary"
  | "surfaceDim"
  | "surfaceBright"
  | "surfaceContainerLowest"
  | "surfaceContainerLow"
  | "surfaceContainer"
  | "surfaceContainerHigh"
  | "surfaceContainerHighest";

type ColorRoleDefinition = {
  [key in ColorRole]: [CoreColorKey, number, number];
};

export interface ColorSchemeConfig {
  readonly name: string;
  readonly displayName: string;
  readonly primary: CSSColorString;
  readonly secondary?: CSSColorString;
  readonly tertiary?: CSSColorString;
  readonly neutral?: CSSColorString;
  readonly neutralVariant?: CSSColorString;
  readonly error?: CSSColorString;
  readonly isDark: boolean;
  readonly contrastLevel?: number;
  readonly paletteSteps?: number;
  readonly customColors?: ReadonlyArray<CustomColorConfig>;
}

type CustomColorConfig = {
  readonly name: string;
  readonly displayName: string;
  readonly sourceColor?: CSSColorString;
  readonly role?: CoreColorKey; // 既存の役割カラーをベースにする場合
  readonly lightLightness?: number; // role指定時のみ有効
  readonly darkLightness?: number; // role指定時のみ有効
  readonly contrastVs?: Record<string, number>;
};

export type ColorScheme = {
  readonly name: string;
  readonly displayName: string;
  readonly roles: Record<ColorRole, Record<string, string | OklchColor>>;
  readonly customColors: Record<
    string,
    Record<string, Record<string, string | OklchColor>>
  >;
  readonly config: ColorSchemeConfig;
};

// ---------------------------------------------------------------------------
//  定数
// ---------------------------------------------------------------------------

const OKLCH_MAX_CHROMA = 0.37; // 最大彩度
const SECONDARY_CHROMA_FACTOR = 0.3;
const TERTIARY_HUE_SHIFT = 180;
const NEUTRAL_CHROMA = 0;
const NEUTRAL_VARIANT_CHROMA = 0.01;
const ERROR_CHROMA = 0.4;
const ERROR_HUE = 30;

const DEFAULT_PALETTE_STEPS = 18;

const defaultColorRoles: ColorRoleDefinition = {
  primary: ["primary", 40, 80],
  onPrimary: ["primary", 100, 20],
  primaryContainer: ["primary", 90, 30],
  onPrimaryContainer: ["primary", 10, 90],
  primaryFixed: ["primary", 85, 85],
  primaryFixedDim: ["primary", 70, 70],
  onPrimaryFixed: ["primary", 10, 10],
  onPrimaryFixedVariant: ["primary", 30, 30],
  secondary: ["secondary", 40, 80],
  onSecondary: ["secondary", 100, 20],
  secondaryContainer: ["secondary", 90, 30],
  onSecondaryContainer: ["secondary", 10, 90],
  secondaryFixed: ["secondary", 85, 85],
  secondaryFixedDim: ["secondary", 70, 70],
  onSecondaryFixed: ["secondary", 10, 10],
  onSecondaryFixedVariant: ["secondary", 30, 30],
  tertiary: ["tertiary", 40, 80],
  onTertiary: ["tertiary", 100, 20],
  tertiaryContainer: ["tertiary", 90, 30],
  onTertiaryContainer: ["tertiary", 10, 90],
  tertiaryFixed: ["tertiary", 90, 90],
  tertiaryFixedDim: ["tertiary", 80, 80],
  onTertiaryFixed: ["tertiary", 10, 10],
  onTertiaryFixedVariant: ["tertiary", 30, 30],
  error: ["error", 40, 80],
  onError: ["error", 100, 20],
  errorContainer: ["error", 90, 30],
  onErrorContainer: ["error", 10, 90],
  background: ["neutral", 99, 10],
  onBackground: ["neutral", 10, 90],
  surface: ["neutral", 99, 10],
  onSurface: ["neutral", 10, 90],
  surfaceVariant: ["neutralVariant", 90, 30],
  onSurfaceVariant: ["neutralVariant", 30, 80],
  outline: ["neutralVariant", 50, 60],
  outlineVariant: ["neutralVariant", 80, 30],
  shadow: ["neutral", 0, 0],
  scrim: ["neutral", 0, 0],
  inverseSurface: ["neutral", 20, 90],
  inverseOnSurface: ["neutral", 95, 20],
  inversePrimary: ["primary", 80, 40],
  surfaceDim: ["neutral", 87, 6],
  surfaceBright: ["neutral", 98, 24],
  surfaceContainerLowest: ["neutral", 100, 4],
  surfaceContainerLow: ["neutral", 96, 10],
  surfaceContainer: ["neutral", 94, 12],
  surfaceContainerHigh: ["neutral", 92, 17],
  surfaceContainerHighest: ["neutral", 90, 22],
};

// ---------------------------------------------------------------------------
//  ユーティリティ関数
// ---------------------------------------------------------------------------

const parseCSSColor = (colorString: CSSColorString): OklchColor => {
  try {
    const color = new Color(colorString).to("oklch");
    return [color.l, color.c, color.h];
  } catch (error) {
    throw new Error(`Failed to parse CSS color string: ${colorString}`);
  }
};

const arrayToColorString = (
  array: OklchColor,
  format: ColorSpace = "oklch",
): string => {
  const color = new Color("oklch", array);
  switch (format) {
    case "oklch":
      return `oklch(${array[0]} ${array[1]} ${array[2]})`;
    case "hex":
      return color.to("srgb").toString({ format: "hex" });
    case "p3":
      return color.to("p3").toString();
    case "srgb":
      return color.to("srgb").toString();
    default:
      throw new Error(`Invalid format: ${format}`);
  }
};

// ---------------------------------------------------------------------------
//  カラージェネレーター
// ---------------------------------------------------------------------------

class CoreColorGenerator {
  private readonly isDark: boolean;

  constructor(config: ColorSchemeConfig) {
    this.isDark = config.isDark;
  }

  private optimizePrimaryColor(color: OklchColor): OklchColor {
    const [l, c, h] = color;
    const lchColor = new Color("oklch", color).to("lch");

    // LCHのLightnessとOKLCHのChroma, Hueを組み合わせる
    const optimizedOklch = new Color("lch", [0.6, 0.13, lchColor.h]).to("oklch");
    return [optimizedOklch.l, c, h];
  }

  private generateSecondaryColor(primary: OklchColor): OklchColor {
    const [l, c, h] = primary;
    const lchColor = new Color("oklch", primary).to("lch");
    const newC = 0.05;
    // LCHのLightnessを使用し、OKLCHのChroma, Hueと組み合わせる
    const newOklch = new Color("lch", [lchColor.l, lchColor.c, lchColor.h]).to(
      "oklch",
    );
    return [newOklch.l, newC, h];
  }

  private generateTertiaryColor(primary: OklchColor): OklchColor {
    const [l, c, h] = primary;
    const lchColor = new Color("oklch", primary).to("lch");
    const newH = (h + TERTIARY_HUE_SHIFT) % 360;
    const newC = 0.1;
    const newOklch = new Color("lch", [0.6, 0.12, lchColor.h]).to(
      "oklch",
    );
    // LCHのLightnessを使用し、OKLCHのChroma, Hueと組み合わせる
    return [newOklch.l, newC, newH];
  }

  private generateNeutralColor(primary: OklchColor): OklchColor {
    const [l, _, h] = primary;
    const lchColor = new Color("oklch", primary).to("lch");
    const newC = Math.min(0.01, NEUTRAL_CHROMA);
    const newOklch = new Color("lch", [lchColor.l, 0.01, lchColor.h]).to("oklch");
    return [newOklch.l, newC, h];
  }

  private generateNeutralVariantColor(primary: OklchColor): OklchColor {
    const [l, _, h] = primary;
    const lchColor = new Color("oklch", primary).to("lch");
    const newC = Math.min(0.03, NEUTRAL_VARIANT_CHROMA);
    const newOklch = new Color("lch", [lchColor.l, 0.03, lchColor.h]).to(
      "oklch",
    );
    return [newOklch.l, newC, h];
  }

  private generateErrorColor(primary: OklchColor): OklchColor {
    const [l, c, _] = primary;
    const lchColor = new Color("oklch", primary).to("lch");
    const newC = Math.max(c, ERROR_CHROMA);
    const newOklch = new Color("lch", [0.6, 0.12, lchColor.h]).to(
      "oklch",
    );
    return [newOklch.l, newC, ERROR_HUE];
  }

  generate(config: ColorSchemeConfig): Record<CoreColorKey, OklchColor> {
    let primary = parseCSSColor(config.primary);
    // プライマリカラーの最適化
    primary = this.optimizePrimaryColor(primary);

    const secondary = config.secondary
      ? parseCSSColor(config.secondary)
      : this.generateSecondaryColor(primary);

    const tertiary = config.tertiary
      ? parseCSSColor(config.tertiary)
      : this.generateTertiaryColor(primary);

    const neutral = config.neutral
      ? parseCSSColor(config.neutral)
      : this.generateNeutralColor(primary);

    const neutralVariant = config.neutralVariant
      ? parseCSSColor(config.neutralVariant)
      : this.generateNeutralVariantColor(primary);

    const error = config.error
      ? parseCSSColor(config.error)
      : this.generateErrorColor(primary);

    return {
      primary,
      secondary,
      tertiary,
      neutral,
      neutralVariant,
      error,
    };
  }

  private adjustLchLightness(color: OklchColor): OklchColor {
    const lchColor = new Color("oklch", color).to("lch");
    const adjustedOklch = new Color("lch", [
      lchColor.l,
      lchColor.c,
      lchColor.h,
    ]).to("oklch");
    return [adjustedOklch.l, color[1], color[2]];
  }
}

class ColorPaletteGenerator {
  private readonly coreColors: Record<CoreColorKey, OklchColor>;
  private readonly colorRoles: ColorRoleDefinition;
  private readonly isDark: boolean;

  constructor(
    coreColors: Record<CoreColorKey, OklchColor>,
    colorRoles: ColorRoleDefinition,
    isDark: boolean,
    private readonly paletteSteps: number = DEFAULT_PALETTE_STEPS,
  ) {
    this.coreColors = coreColors;
    this.colorRoles = colorRoles;
    this.isDark = isDark;
  }

  generate(): Record<ColorRole, OklchColor> {
    const colors: Record<ColorRole, OklchColor> = {} as Record<ColorRole, OklchColor>;

    for (const [roleName, [baseName, lightValue, darkValue]] of Object.entries(
      this.colorRoles
    ) as [ColorRole, [CoreColorKey, number, number]][]) {
      const baseColor = this.coreColors[baseName];
      const baseColorLch = new Color("oklch", baseColor).to("lch");
      const lchLightness = this.isDark ? darkValue : lightValue;
      const adjustedColor = new Color("lch", [
        lchLightness,
        baseColorLch.c,
        baseColorLch.h,
      ]).to("oklch");
      colors[roleName] = [adjustedColor.l, baseColor[1], baseColor[2]];
    }

    return colors;
  }
}

class CustomColorGenerator {
  static generate(
    config: ColorSchemeConfig,
    coreColors: Record<string, OklchColor>,
  ): Record<string, OklchColor> {
    const customColors: Record<string, OklchColor> = {};
    const isDark = config.isDark;

    for (const customColor of config.customColors || []) {
      const generatedColor = this.generateCustomColor(
        customColor,
        coreColors,
        isDark,
      );
      customColors[customColor.name] = generatedColor;
    }
    return customColors;
  }

  private static generateCustomColor(
    config: CustomColorConfig,
    coreColors: Record<string, OklchColor>,
    isDark: boolean,
  ): OklchColor {
    let sourceColor: OklchColor;
    if (config.role && config.role in coreColors) {
      sourceColor = coreColors[config.role];
    } else if (config.sourceColor) {
      sourceColor = parseCSSColor(config.sourceColor);
    } else {
      throw new Error(`Invalid custom color configuration for: ${config.name}`);
    }

    const sourceLch = new Color("oklch", sourceColor).to("lch");

    const lchLightness = isDark
      ? config.darkLightness != undefined
        ? config.darkLightness
        : sourceLch.l
      : config.lightLightness != undefined
        ? config.lightLightness
        : sourceLch.l;

    let newC = 0;
    switch (config.role) {
      case "primary":
        newC = 0.12;
        break;
      case "secondary":
        newC = 0.04;
        break;
      case "tertiary":
        newC = 0.12;
        break;
      case "neutral":
        newC = 0.01;
        break;
      case "neutralVariant":
        newC = 0.03;
        break;
      case "error":
        newC = 0.12;
        break;
      default:
        newC = sourceLch.c;
    }

    const adjustedColor = new Color("lch", [
      lchLightness,
      sourceLch.c,
      sourceLch.h,
    ]).to("oklch");
    return [adjustedColor.l, newC, sourceColor[2]];
  }
}

// ---------------------------------------------------------------------------
//  カラースキームファクトリー
// ---------------------------------------------------------------------------

class ColorSchemeFactory {
  static create(config: ColorSchemeConfig): ColorScheme {
    const primaryColor = parseCSSColor(config.primary);
    const secondaryColor = config.secondary
      ? parseCSSColor(config.secondary)
      : undefined;

    const coreColorGenerator = new CoreColorGenerator(
      primaryColor,
      secondaryColor,
      config,
    );
    const coreColors = coreColorGenerator.generate(config);

    const colorPaletteGenerator = new ColorPaletteGenerator(
      coreColors,
      defaultColorRoles,
      config.isDark,
      config.paletteSteps || DEFAULT_PALETTE_STEPS,
    );
    const colorPalette = colorPaletteGenerator.generate();

    const customColors = CustomColorGenerator.generate(config, {
      ...coreColors,
      ...colorPalette,
    });

    const colorRoles = Object.entries(colorPalette).reduce(
      (acc, [role, color]) => {
        acc[role as ColorRole] = {
          array: color,
          hex: arrayToColorString(color, "hex"),
          oklch: arrayToColorString(color, "oklch"),
          p3: arrayToColorString(color, "p3"),
          srgb: arrayToColorString(color, "srgb"),
        };
        return acc;
      },
      {} as Record<ColorRole, Record<string, string | OklchColor>>,
    );

    // カスタムカラーのフォーマット変換
    const formattedCustomColors = Object.entries(customColors).reduce(
      (acc, [name, color]) => {
        acc[name] = {
          color: {
            array: color,
            hex: arrayToColorString(color, "hex"),
            oklch: arrayToColorString(color, "oklch"),
            p3: arrayToColorString(color, "p3"),
            srgb: arrayToColorString(color, "srgb"),
          },
        };
        return acc;
      },
      {} as Record<string, Record<string, Record<string, string | OklchColor>>>,
    );

    return {
      name: config.name,
      displayName: config.displayName,
      roles: colorRoles,
      customColors: formattedCustomColors,
      config,
    };
  }
}
// ---------------------------------------------------------------------------
//  コントラストチェッカー
// ---------------------------------------------------------------------------

export type CheckType =
  | "text"
  | "largeText"
  | "ui"
  | "structure"
  | "decorative"
  | "custom";

export type ContrastCheckResult = {
  color1Name: string;
  color2Name: string;
  color1: OklchColor;
  color2: OklchColor;
  contrastRatio: number;
  pass: boolean;
  requiredRatio: number;
};

export class ColorSchemeContrastChecker {
  private readonly colorScheme: ColorScheme;

  constructor(colorScheme: ColorScheme) {
    this.colorScheme = colorScheme;
  }

  // rolesとcustomColorsのプロパティアクセスを共通化
  private getColor(target: ColorRole | string): OklchColor | undefined {
    const color =
      this.colorScheme.roles[target as ColorRole]?.array ||
      this.colorScheme.customColors[target]?.color?.array;
    return color as OklchColor | undefined;
  }
  private getContrastRatio(color1: OklchColor, color2: OklchColor): number {
    const contrast = Color.contrast(
      new Color("oklch", color1),
      new Color("oklch", color2),
      { algorithm: "WCAG21" },
    );
    return contrast;
  }

  checkContrast(
    color1Name: string,
    color2Name: string,
    type: CheckType = "text",
  ): ContrastCheckResult {
    const color1 = this.getColor(color1Name);
    const color2 = this.getColor(color2Name);

    if (!color1 || !color2) {
      throw new Error(`Could not find colors: ${color1Name} or ${color2Name}`);
    }

    const contrastRatio = this.getContrastRatio(color1, color2);

    let requiredRatio = 4.5; // デフォルトはAAレベルのテキスト
    let passes = contrastRatio >= requiredRatio;

    switch (type) {
      case "text":
        requiredRatio = 4.5;
        break;
      case "largeText":
        requiredRatio = 3; // Large Textはコントラスト比3:1以上
        break;
      case "ui":
        requiredRatio = 3;
        break;
      case "structure":
        requiredRatio = 1.5;
        break;
      case "decorative":
        requiredRatio = 1; // decorativeはコントラスト比のチェックを行わない
        break;
      case "custom": {
        const customColorConfig = this.colorScheme.config.customColors?.find(
          (config) => config.name === color1Name,
        );
        requiredRatio =
          customColorConfig?.contrastVs?.[color2Name] ?? 1;
        break;
      }
    }

    passes = contrastRatio >= requiredRatio;

    return {
      color1Name,
      color2Name,
      color1: color1,
      color2: color2,
      contrastRatio,
      pass: passes,
      requiredRatio,
    };
  }

  runAllChecks(): ContrastCheckResult[] {
    const results: ContrastCheckResult[] = [];

    // 標準チェック
    const standardChecks: {
      color1: ColorRole;
      color2: ColorRole;
      type: CheckType;
    }[] = [
      { color1: "primary", color2: "onPrimary", type: "text" },
      {
        color1: "primaryContainer",
        color2: "onPrimaryContainer",
        type: "text",
      },
      { color1: "secondary", color2: "onSecondary", type: "text" },
      {
        color1: "secondaryContainer",
        color2: "onSecondaryContainer",
        type: "text",
      },
      { color1: "tertiary", color2: "onTertiary", type: "text" },
      {
        color1: "tertiaryContainer",
        color2: "onTertiaryContainer",
        type: "text",
      },
      { color1: "error", color2: "onError", type: "text" },
      {
        color1: "errorContainer",
        color2: "onErrorContainer",
        type: "text",
      },
      { color1: "background", color2: "onBackground", type: "text" },
      { color1: "surface", color2: "onSurface", type: "text" },
      {
        color1: "surfaceVariant",
        color2: "onSurfaceVariant",
        type: "text",
      },
      {
        color1: "inverseSurface",
        color2: "inverseOnSurface",
        type: "text",
      },
      { color1: "outline", color2: "background", type: "ui" },
      {
        color1: "outlineVariant",
        color2: "surface",
        type: "structure",
      },
    ];

    standardChecks.forEach(({ color1, color2, type }) => {
      results.push(this.checkContrast(color1, color2, type));
    });

    // カスタムカラーのチェック
    this.colorScheme.config.customColors?.forEach((customColor) => {
      if ("contrastVs" in customColor) {
        Object.entries(customColor.contrastVs || []).forEach(
          ([targetColor, requiredRatio]) => {
            results.push(
              this.checkContrast(customColor.name, targetColor, "custom"),
            );
          },
        );
      }
    });

    return results;
  }
}

// ---------------------------------------------------------------------------
//  エクスポート
// ---------------------------------------------------------------------------

export { ColorSchemeFactory };
export type { ColorSchemeConfig, ColorRole };

export const cssVariablesFromColorScheme = (
  colorScheme: ColorScheme,
): Record<string, string> => {
  const cssVars: Record<string, string> = {};

  const toKebabCase = (str: string) => {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  };

  const setColorVar = (prefix: string, key: string, value: OklchColor) => {
    const [l, c, h] = value;
    const oklch = arrayToColorString(value, "oklch");
    cssVars[`--${prefix}-${toKebabCase(key)}`] = oklch;
  };

  // ベースカラーのCSS変数
  Object.entries(colorScheme.roles).forEach(([key, value]) => {
    setColorVar("md-sys-color", key, value.array as OklchColor);
  });

  // カスタムカラーのCSS変数
  Object.entries(colorScheme.customColors).forEach(
    ([customColorKey, colorVariants]) => {
      Object.entries(colorVariants).forEach(([variant, colorValue]) => {
        setColorVar(
          "md-custom-color",
          `${customColorKey}`,
          colorValue.array as OklchColor,
        );
      });
    },
  );

  return cssVars;
};
