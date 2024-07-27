import { ColorRole } from "./types";

// 定義済み UI ロール
export const DEFINED_COLOR_ROLES: {
  name: string;
  role: ColorRole;
  lightShade: number;
  darkShade: number;
}[] = [
  {
    name: "primary",
    role: "primary",
    lightShade: 0.48,
    darkShade: 0.8,
  },
  {
    name: "onPrimary",
    role: "primary",
    lightShade: 1,
    darkShade: 0.32,
  },
  {
    name: "primaryContainer",
    role: "primary",
    lightShade: 0.92,
    darkShade: 0.4,
  },
  {
    name: "onPrimaryContainer",
    role: "primary",
    lightShade: 0.24,
    darkShade: 0.92,
  },
  {
    name: "primaryFixed",
    role: "primary",
    lightShade: 0.84,
    darkShade: 0.84,
  },
  {
    name: "primaryFixedDim",
    role: "primary",
    lightShade: 0.72,
    darkShade: 0.72,
  },
  {
    name: "onPrimaryFixed",
    role: "primary",
    lightShade: 0.24,
    darkShade: 0.4,
  },
  {
    name: "onPrimaryFixedVariant",
    role: "primary",
    lightShade: 0.4,
    darkShade: 0.4,
  },
  {
    name: "secondary",
    role: "secondary",
    lightShade: 0.48,
    darkShade: 0.8,
  },
  {
    name: "onSecondary",
    role: "secondary",
    lightShade: 1,
    darkShade: 0.32,
  },
  {
    name: "secondaryContainer",
    role: "secondary",
    lightShade: 0.92,
    darkShade: 0.4,
  },
  {
    name: "onSecondaryContainer",
    role: "secondary",
    lightShade: 0.24,
    darkShade: 0.92,
  },
  {
    name: "secondaryFixed",
    role: "secondary",
    lightShade: 0.84,
    darkShade: 0.84,
  },
  {
    name: "secondaryFixedDim",
    role: "secondary",
    lightShade: 0.72,
    darkShade: 0.72,
  },
  {
    name: "onSecondaryFixed",
    role: "secondary",
    lightShade: 0.24,
    darkShade: 0.24,
  },
  {
    name: "onSecondaryFixedVariant",
    role: "secondary",
    lightShade: 0.4,
    darkShade: 0.4,
  },
  {
    name: "tertiary",
    role: "tertiary",
    lightShade: 0.48,
    darkShade: 0.8,
  },
  {
    name: "onTertiary",
    role: "tertiary",
    lightShade: 1,
    darkShade: 0.32,
  },
  {
    name: "tertiaryContainer",
    role: "tertiary",
    lightShade: 0.92,
    darkShade: 0.4,
  },
  {
    name: "onTertiaryContainer",
    role: "tertiary",
    lightShade: 0.24,
    darkShade: 0.92,
  },
  {
    name: "tertiaryFixed",
    role: "tertiary",
    lightShade: 0.84,
    darkShade: 0.84,
  },
  {
    name: "tertiaryFixedDim",
    role: "tertiary",
    lightShade: 0.72,
    darkShade: 0.72,
  },
  {
    name: "onTertiaryFixed",
    role: "tertiary",
    lightShade: 0.24,
    darkShade: 0.24,
  },
  {
    name: "onTertiaryFixedVariant",
    role: "tertiary",
    lightShade: 0.4,
    darkShade: 0.4,
  },
  {
    name: "error",
    role: "error",
    lightShade: 0.48,
    darkShade: 0.8,
  },
  {
    name: "onError",
    role: "error",
    lightShade: 1,
    darkShade: 0.32,
  },
  {
    name: "errorContainer",
    role: "error",
    lightShade: 0.92,
    darkShade: 0.4,
  },
  {
    name: "onErrorContainer",
    role: "error",
    lightShade: 0.24,
    darkShade: 0.92,
  },
  {
    name: "background",
    role: "neutral",
    lightShade: 0.99,
    darkShade: 0.24,
  },
  {
    name: "onBackground",
    role: "neutral",
    lightShade: 0.24,
    darkShade: 0.92,
  },
  {
    name: "surface",
    role: "neutral",
    lightShade: 0.99,
    darkShade: 0.24,
  },
  {
    name: "onSurface",
    role: "neutral",
    lightShade: 0.24,
    darkShade: 0.92,
  },
  {
    name: "surfaceVariant",
    role: "neutralVariant",
    lightShade: 0.92,
    darkShade: 0.4,
  },
  {
    name: "onSurfaceVariant",
    role: "neutralVariant",
    lightShade: 0.4,
    darkShade: 0.8,
  },
  {
    name: "outline",
    role: "neutralVariant",
    lightShade: 0.56,
    darkShade: 0.64,
  },
  {
    name: "outlineVariant",
    role: "neutralVariant",
    lightShade: 0.8,
    darkShade: 0.4,
  },
  {
    name: "shadow",
    role: "neutral",
    lightShade: 0,
    darkShade: 0,
  },
  {
    name: "scrim",
    role: "neutral",
    lightShade: 0,
    darkShade: 0,
  },
  {
    name: "inverseSurface",
    role: "neutral",
    lightShade: 0.32,
    darkShade: 0.92,
  },
  {
    name: "inverseOnSurface",
    role: "neutral",
    lightShade: 0.95,
    darkShade: 0.32,
  },
  {
    name: "inversePrimary",
    role: "primary",
    lightShade: 0.8,
    darkShade: 0.48,
  },
  {
    name: "surfaceDim",
    role: "neutral",
    lightShade: 0.88,
    darkShade: 0.2,
  },
  {
    name: "surfaceBright",
    role: "neutral",
    lightShade: 0.96,
    darkShade: 0.36,
  },
  {
    name: "surfaceContainerLowest",
    role: "neutral",
    lightShade: 1,
    darkShade: 0.16,
  },
  {
    name: "surfaceContainerLow",
    role: "neutral",
    lightShade: 0.96,
    darkShade: 0.24,
  },
  {
    name: "surfaceContainer",
    role: "neutral",
    lightShade: 0.92,
    darkShade: 0.24,
  },
  {
    name: "surfaceContainerHigh",
    role: "neutral",
    lightShade: 0.94,
    darkShade: 0.28,
  },
  {
    name: "surfaceContainerHighest",
    role: "neutral",
    lightShade: 0.96,
    darkShade: 0.36,
  },
];

// パレットの明度レベル
// 5%刻みだと使いづらい...ほぼ4%刻みで0.2以上を使う
export const PALETTE_SHADES: number[] = [
  0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32, 0.36, 0.4, 0.44, 0.48, 0.52,
  0.56, 0.6, 0.64, 0.68, 0.72, 0.76, 0.8, 0.84, 0.88, 0.9, 0.92, 0.94, 0.96,
  0.98, 0.99, 1,
];
