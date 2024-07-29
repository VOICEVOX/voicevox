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
    lightShade: 0.5,
    darkShade: 0.8,
  },
  {
    name: "onPrimary",
    role: "primary",
    lightShade: 1,
    darkShade: 0.3,
  },
  {
    name: "primaryContainer",
    role: "primary",
    lightShade: 0.9,
    darkShade: 0.4,
  },
  {
    name: "onPrimaryContainer",
    role: "primary",
    lightShade: 0.25,
    darkShade: 0.9,
  },
  {
    name: "primaryFixed",
    role: "primary",
    lightShade: 0.85,
    darkShade: 0.85,
  },
  {
    name: "primaryFixedDim",
    role: "primary",
    lightShade: 0.75,
    darkShade: 0.75,
  },
  {
    name: "onPrimaryFixed",
    role: "primary",
    lightShade: 0.25,
    darkShade: 0.25,
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
    lightShade: 0.5,
    darkShade: 0.8,
  },
  {
    name: "onSecondary",
    role: "secondary",
    lightShade: 1,
    darkShade: 0.3,
  },
  {
    name: "secondaryContainer",
    role: "secondary",
    lightShade: 0.9,
    darkShade: 0.4,
  },
  {
    name: "onSecondaryContainer",
    role: "secondary",
    lightShade: 0.25,
    darkShade: 0.9,
  },
  {
    name: "secondaryFixed",
    role: "secondary",
    lightShade: 0.85,
    darkShade: 0.85,
  },
  {
    name: "secondaryFixedDim",
    role: "secondary",
    lightShade: 0.75,
    darkShade: 0.75,
  },
  {
    name: "onSecondaryFixed",
    role: "secondary",
    lightShade: 0.25,
    darkShade: 0.25,
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
    lightShade: 0.5,
    darkShade: 0.8,
  },
  {
    name: "onTertiary",
    role: "tertiary",
    lightShade: 1,
    darkShade: 0.3,
  },
  {
    name: "tertiaryContainer",
    role: "tertiary",
    lightShade: 0.9,
    darkShade: 0.4,
  },
  {
    name: "onTertiaryContainer",
    role: "tertiary",
    lightShade: 0.25,
    darkShade: 0.9,
  },
  {
    name: "tertiaryFixed",
    role: "tertiary",
    lightShade: 0.8,
    darkShade: 0.8,
  },
  {
    name: "tertiaryFixedDim",
    role: "tertiary",
    lightShade: 0.7,
    darkShade: 0.7,
  },
  {
    name: "onTertiaryFixed",
    role: "tertiary",
    lightShade: 0.25,
    darkShade: 0.25,
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
    lightShade: 0.5,
    darkShade: 0.8,
  },
  {
    name: "onError",
    role: "error",
    lightShade: 1,
    darkShade: 0.3,
  },
  {
    name: "errorContainer",
    role: "error",
    lightShade: 0.9,
    darkShade: 0.4,
  },
  {
    name: "onErrorContainer",
    role: "error",
    lightShade: 0.25,
    darkShade: 0.9,
  },
  {
    name: "background",
    role: "neutral",
    lightShade: 0.99,
    darkShade: 0.25,
  },
  {
    name: "onBackground",
    role: "neutral",
    lightShade: 0.25,
    darkShade: 0.9,
  },
  {
    name: "surface",
    role: "neutral",
    lightShade: 0.99,
    darkShade: 0.25,
  },
  {
    name: "onSurface",
    role: "neutral",
    lightShade: 0.25,
    darkShade: 0.9,
  },
  {
    name: "surfaceVariant",
    role: "neutralVariant",
    lightShade: 0.9,
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
    lightShade: 0.5,
    darkShade: 0.65,
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
    lightShade: 0.3,
    darkShade: 0.9,
  },
  {
    name: "inverseOnSurface",
    role: "neutral",
    lightShade: 0.95,
    darkShade: 0.3,
  },
  {
    name: "inversePrimary",
    role: "primary",
    lightShade: 0.8,
    darkShade: 0.5,
  },
  {
    name: "surfaceDim",
    role: "neutral",
    lightShade: 0.9,
    darkShade: 0.2,
  },
  {
    name: "surfaceBright",
    role: "neutral",
    lightShade: 0.95,
    darkShade: 0.35,
  },
  {
    name: "surfaceContainerLowest",
    role: "neutral",
    lightShade: 0.88,
    darkShade: 0.2,
  },
  {
    name: "surfaceContainerLow",
    role: "neutral",
    lightShade: 0.93,
    darkShade: 0.24,
  },
  {
    name: "surfaceContainer",
    role: "neutral",
    lightShade: 0.95,
    darkShade: 0.28,
  },
  {
    name: "surfaceContainerHigh",
    role: "neutral",
    lightShade: 0.99,
    darkShade: 0.28,
  },
  {
    name: "surfaceContainerHighest",
    role: "neutral",
    lightShade: 1,
    darkShade: 0.36,
  },
];

// パレットの明度レベル
export const PALETTE_SHADES: number[] = [
  0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.5, 0.6,
  0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.92, 0.94, 0.96, 0.98, 0.99, 1,
];
