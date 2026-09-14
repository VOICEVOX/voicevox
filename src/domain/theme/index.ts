import { assertNonNullable, ExhaustiveError } from "@/type/utility";
import type { NativeThemeType, ThemeConf, ThemeSetting } from "@/type/preload";

const light = {
  name: "Default",
  displayName: "デフォルト",
  order: 1,
  isDark: false,
  colors: {
    primary: "#A5D4AD",
    display: "#121212",
    "display-on-primary": "#121212",
    "display-hyperlink": "#0969DA",
    background: "#FFFFFF",
    surface: "#EEEEEE",
    warning: "#C10015",
    "text-splitter-hover": "#CCDDFF",
    "active-point-focus": "#E0EAFF",
    "active-point-hover": "#EEF3FF",
  },
} as const satisfies ThemeConf;

const dark = {
  name: "Dark",
  displayName: "ダーク",
  order: 2,
  isDark: true,
  colors: {
    primary: "#86C591",
    display: "#E1E1E1",
    "display-on-primary": "#1F1F1F",
    "display-hyperlink": "#58A6FF",
    background: "#1F1F1F",
    surface: "#2B2B2B",
    warning: "#F27483",
    "text-splitter-hover": "#394152",
    "active-point-focus": "#292F38",
    "active-point-hover": "#272A2F",
  },
} as const satisfies ThemeConf;

export const themes = [light, dark];

/** テーマ名からテーマを取得する */
export const getThemeByName = (
  themeName: ThemeConf["name"],
  availableThemes: readonly ThemeConf[],
): ThemeConf => {
  const theme = availableThemes.find((value) => value.name === themeName);
  assertNonNullable(theme, `テーマが見つかりません: ${themeName}`);
  return theme;
};

/** 明暗状態からテーマを取得する */
export const getThemeByIsDark = (
  isDark: boolean,
  availableThemes: readonly ThemeConf[],
): ThemeConf => {
  const theme = availableThemes.find((value) => value.isDark === isDark);
  assertNonNullable(theme, `テーマが見つかりません: 明暗=${isDark}`);
  return theme;
};

/** テーマ設定からNativeのテーマを解決する */
export const resolveNativeTheme = (
  themeSetting: ThemeSetting,
): NativeThemeType => {
  switch (themeSetting) {
    case "Default":
      return "light";
    case "Dark":
      return "dark";
    case "System":
      return "system";
    default:
      throw new ExhaustiveError(themeSetting);
  }
};
