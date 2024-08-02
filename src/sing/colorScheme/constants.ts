import { ColorRole } from "./types";

// 定義済みUIロール名
export const DEFINED_ROLES: ColorRole[] = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
  "error",
];

// 定義済みUIロールカラー
export const DEFINED_REF_COLOR_ROLES: {
  name: string;
  role: ColorRole;
  lightShade: number;
  darkShade: number;
}[] = [
  {
    name: "primary",
    role: "primary",
    lightShade: 0.4,
    darkShade: 0.8,
  },
  {
    name: "onPrimary",
    role: "primary",
    lightShade: 1.0,
    darkShade: 0.2,
  },
  {
    name: "primaryContainer",
    role: "primary",
    lightShade: 0.9,
    darkShade: 0.3,
  },
  {
    name: "onPrimaryContainer",
    role: "primary",
    lightShade: 0.1,
    darkShade: 0.9,
  },
  {
    name: "primaryFixed",
    role: "primary",
    lightShade: 0.9,
    darkShade: 0.9,
  },
  {
    name: "primaryFixedDim",
    role: "primary",
    lightShade: 0.8,
    darkShade: 0.8,
  },
  {
    name: "onPrimaryFixed",
    role: "primary",
    lightShade: 0.1,
    darkShade: 0.1,
  },
  {
    name: "onPrimaryFixedVariant",
    role: "primary",
    lightShade: 0.3,
    darkShade: 0.3,
  },
  {
    name: "secondary",
    role: "secondary",
    lightShade: 0.4,
    darkShade: 0.8,
  },
  {
    name: "onSecondary",
    role: "secondary",
    lightShade: 1.0,
    darkShade: 0.2,
  },
  {
    name: "secondaryContainer",
    role: "secondary",
    lightShade: 0.9,
    darkShade: 0.3,
  },
  {
    name: "onSecondaryContainer",
    role: "secondary",
    lightShade: 0.1,
    darkShade: 0.9,
  },
  {
    name: "secondaryFixed",
    role: "secondary",
    lightShade: 0.9,
    darkShade: 0.9,
  },
  {
    name: "secondaryFixedDim",
    role: "secondary",
    lightShade: 0.8,
    darkShade: 0.8,
  },
  {
    name: "onSecondaryFixed",
    role: "secondary",
    lightShade: 0.1,
    darkShade: 0.1,
  },
  {
    name: "onSecondaryFixedVariant",
    role: "secondary",
    lightShade: 0.3,
    darkShade: 0.3,
  },
  {
    name: "tertiary",
    role: "tertiary",
    lightShade: 0.4,
    darkShade: 0.8,
  },
  {
    name: "onTertiary",
    role: "tertiary",
    lightShade: 1.0,
    darkShade: 0.2,
  },
  {
    name: "tertiaryContainer",
    role: "tertiary",
    lightShade: 0.9,
    darkShade: 0.3,
  },
  {
    name: "onTertiaryContainer",
    role: "tertiary",
    lightShade: 0.1,
    darkShade: 0.9,
  },
  {
    name: "tertiaryFixed",
    role: "tertiary",
    lightShade: 0.9,
    darkShade: 0.9,
  },
  {
    name: "tertiaryFixedDim",
    role: "tertiary",
    lightShade: 0.8,
    darkShade: 0.8,
  },
  {
    name: "onTertiaryFixed",
    role: "tertiary",
    lightShade: 0.1,
    darkShade: 0.1,
  },
  {
    name: "onTertiaryFixedVariant",
    role: "tertiary",
    lightShade: 0.3,
    darkShade: 0.3,
  },
  {
    name: "error",
    role: "error",
    lightShade: 0.4,
    darkShade: 0.8,
  },
  {
    name: "onError",
    role: "error",
    lightShade: 1.0,
    darkShade: 0.2,
  },
  {
    name: "errorContainer",
    role: "error",
    lightShade: 0.9,
    darkShade: 0.3,
  },
  {
    name: "onErrorContainer",
    role: "error",
    lightShade: 0.1,
    darkShade: 0.9,
  },
  {
    name: "background",
    role: "neutral",
    lightShade: 0.99,
    darkShade: 0.1,
  },
  {
    name: "onBackground",
    role: "neutral",
    lightShade: 0.1,
    darkShade: 0.9,
  },
  {
    name: "surface",
    role: "neutral",
    lightShade: 0.99,
    darkShade: 0.1,
  },
  {
    name: "onSurface",
    role: "neutral",
    lightShade: 0.1,
    darkShade: 0.9,
  },
  {
    name: "surfaceVariant",
    role: "neutralVariant",
    lightShade: 0.9,
    darkShade: 0.3,
  },
  {
    name: "onSurfaceVariant",
    role: "neutralVariant",
    lightShade: 0.3,
    darkShade: 0.8,
  },
  {
    name: "outline",
    role: "neutralVariant",
    lightShade: 0.5,
    darkShade: 0.6,
  },
  {
    name: "outlineVariant",
    role: "neutralVariant",
    lightShade: 0.8,
    darkShade: 0.3,
  },
  {
    name: "shadow",
    role: "neutral",
    lightShade: 0.0,
    darkShade: 0.0,
  },
  {
    name: "scrim",
    role: "neutral",
    lightShade: 0.0,
    darkShade: 0.0,
  },
  {
    name: "inverseSurface",
    role: "neutral",
    lightShade: 0.2,
    darkShade: 0.9,
  },
  {
    name: "inverseOnSurface",
    role: "neutral",
    lightShade: 0.95,
    darkShade: 0.2,
  },
  {
    name: "inversePrimary",
    role: "primary",
    lightShade: 0.8,
    darkShade: 0.4,
  },
  {
    name: "surfaceDim",
    role: "neutral",
    lightShade: 0.87,
    darkShade: 0.06,
  },
  {
    name: "surfaceBright",
    role: "neutral",
    lightShade: 0.98,
    darkShade: 0.24,
  },
  {
    name: "surfaceContainerLowest",
    role: "neutral",
    lightShade: 1.0,
    darkShade: 0.04,
  },
  {
    name: "surfaceContainerLow",
    role: "neutral",
    lightShade: 0.96,
    darkShade: 0.1,
  },
  {
    name: "surfaceContainer",
    role: "neutral",
    lightShade: 0.94,
    darkShade: 0.12,
  },
  {
    name: "surfaceContainerHigh",
    role: "neutral",
    lightShade: 0.92,
    darkShade: 0.17,
  },
  {
    name: "surfaceContainerHighest",
    role: "neutral",
    lightShade: 0.9,
    darkShade: 0.22,
  },
];

export const CUSTOM_COLOR_ROLES = [
  {
    name: "${customColorName}",
    role: "primary",
    lightShade: 0.4,
    darkShade: 0.8,
  },
  {
    name: "on${customColorName}",
    role: "primary",
    lightShade: 1.0,
    darkShade: 0.2,
  },
  {
    name: "${customColorName}Container",
    role: "primary",
    lightShade: 0.9,
    darkShade: 0.3,
  },
  {
    name: "on${customColorName}Container",
    role: "primary",
    lightShade: 0.1,
    darkShade: 0.9,
  },
];

// パレットの明度レベル
export const PALETTE_SHADES: number[] = [
  0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65,
  0.7, 0.75, 0.8, 0.85, 0.9, 0.92, 0.95, 0.98, 0.99, 1,
];
