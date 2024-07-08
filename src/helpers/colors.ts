import {
  argbFromHex,
  hexFromArgb,
  Hct,
  DynamicScheme,
  SchemeContent,
  SchemeTonalSpot,
  SchemeNeutral,
  SchemeVibrant,
  SchemeExpressive,
  SchemeFidelity,
  SchemeMonochrome,
  SchemeRainbow,
  SchemeFruitSalad,
  TonalPalette,
  MaterialDynamicColors,
} from "@material/material-color-utilities";

// MaterialDynamicColorのスキーマ
export type SchemeVariant =
  | "content"
  | "tonalSpot"
  | "neutral"
  | "vibrant"
  | "expressive"
  | "fidelity"
  | "monochrome"
  | "rainbow"
  | "fruitSalad";

// M3カラーパレットのキー
export type PaletteKey =
  | "primary"
  | "secondary"
  | "tertiary"
  | "neutral"
  | "neutralVariant"
  | "error";

// テーマにおける色相・彩度・明度の調整
interface ColorAdjustment {
  hue?: number;
  chroma?: number;
  tone?: number;
}

// テーマオプション
interface ThemeOptions {
  sourceColor: string;
  variant?: SchemeVariant;
  isDark?: boolean;
  contrastLevel?: number;
  adjustments?: Partial<Record<PaletteKey, ColorAdjustment>>;
}

// カスタムカラー(固定値)
interface CustomColor {
  name: string;
  value: string;
  blend: boolean;
}

// カスタムカラー(パレットからtoneを指定して取得)
interface CustomPaletteColor {
  name: string;
  palette: PaletteKey;
  lightTone: number;
  darkTone: number;
  blend: boolean;
}

// テーマスキーマ
const SCHEME_CONSTRUCTORS: Record<
  SchemeVariant,
  new (
    sourceColorHct: Hct,
    isDark: boolean,
    contrastLevel: number,
  ) => DynamicScheme
> = {
  content: SchemeContent,
  tonalSpot: SchemeTonalSpot,
  neutral: SchemeNeutral,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  fidelity: SchemeFidelity,
  monochrome: SchemeMonochrome,
  rainbow: SchemeRainbow,
  fruitSalad: SchemeFruitSalad,
};

// デフォルトテーマオプション
const DEFAULT_OPTIONS: Partial<ThemeOptions> = {
  variant: "tonalSpot",
  isDark: false,
  contrastLevel: 0.0,
};

// パレットのキー
const PALETTE_KEYS: PaletteKey[] = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
  "error",
];

// テーマパレットの明度
const TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];

// キャメルケバブケースをケバブケースに変換
const toKebabCase = (str: string) => {
  return str
    .split(/(?=[A-Z])/)
    .join("-")
    .toLowerCase();
};

// パレットの調整
function adjustPalette(
  palette: TonalPalette,
  adjustment: ColorAdjustment,
): TonalPalette {
  // 色相・彩度・明度に調整があった場合、新しいパレットを作成
  const hue = adjustment.hue ?? palette.hue;
  const chroma = adjustment.chroma ?? palette.chroma;
  return adjustment.tone != undefined
    ? TonalPalette.fromHueAndChroma(
        Hct.from(hue, chroma, adjustment.tone).hue,
        Hct.from(hue, chroma, adjustment.tone).chroma,
      )
    : TonalPalette.fromHueAndChroma(hue, chroma);
}

// ダイナミックスキーマを作成
export function createDynamicScheme(options: ThemeOptions): DynamicScheme {
  const { sourceColor, variant, isDark, contrastLevel, adjustments } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const sourceColorHct = Hct.fromInt(argbFromHex(sourceColor));
  const SchemeConstructor = SCHEME_CONSTRUCTORS[variant!];

  if (!SchemeConstructor) {
    throw new Error(`Unsupported scheme variant: ${variant}`);
  }

  let scheme = new SchemeConstructor(sourceColorHct, isDark!, contrastLevel!);

  // 必要に応じてパレットを調整
  if (adjustments) {
    const adjustedPalettes = PALETTE_KEYS.reduce(
      (acc, key) => {
        if (adjustments[key]) {
          acc[`${key}Palette`] = adjustPalette(
            scheme[`${key}Palette` as keyof DynamicScheme] as TonalPalette,
            adjustments[key]!,
          );
        }
        return acc;
      },
      {} as Partial<Record<string, TonalPalette>>,
    );

    scheme = Object.create(Object.getPrototypeOf(scheme), {
      ...Object.getOwnPropertyDescriptors(scheme),
      ...Object.fromEntries(
        Object.entries(adjustedPalettes).map(([key, value]) => [
          key,
          { value, writable: false },
        ]),
      ),
    });
  }

  return scheme;
}

// ダイナミックスキーマをCSS変数に変換
export function dynamicSchemeToCssVariables(
  scheme: DynamicScheme,
  customPaletteColors: CustomPaletteColor[] = [],
  definedCustomColors: CustomColor[] = [],
): Record<string, string> {
  // システムカラーをCSS変数に変換
  const systemColors = Object.entries(MaterialDynamicColors).reduce(
    (acc, [name, color]) => {
      if (typeof color === "object" && "getArgb" in color) {
        acc[`--md-sys-color-${name.replace(/([A-Z])/g, "-$1").toLowerCase()}`] =
          hexFromArgb(color.getArgb(scheme));
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  // パレットの色相・彩度・明度をCSS変数に変換
  const paletteTones = PALETTE_KEYS.flatMap((key) =>
    TONES.map((tone) => [
      `--md-ref-palette-${toKebabCase(key)}-${tone}`,
      hexFromArgb(
        (scheme[`${key}Palette` as keyof DynamicScheme] as TonalPalette).tone(
          tone,
        ),
      ),
    ]),
  );

  // カスタムパレットカラーをCSS変数に変換
  const customPalettes = customPaletteColors.map(
    ({ name, palette, lightTone, darkTone }) => [
      `--md-custom-color-${name}`,
      hexFromArgb(
        (
          scheme[`${palette}Palette` as keyof DynamicScheme] as TonalPalette
        ).tone(scheme.isDark ? darkTone : lightTone),
      ),
    ],
  );

  // カスタムカラーをCSS変数に変換
  const customColors = definedCustomColors.map(({ name, value }) => [
    `--md-custom-color-${name}`,
    value,
  ]);

  return Object.fromEntries([
    ...Object.entries(systemColors),
    ...paletteTones,
    ...customPalettes,
    ...customColors,
  ]);
}
