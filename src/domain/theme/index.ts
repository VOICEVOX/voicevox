import { ThemeConf } from "@/type/preload";

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
