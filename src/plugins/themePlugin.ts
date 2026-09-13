import {
  computed,
  effectScope,
  inject,
  shallowRef,
  watch,
  type App,
  type ComputedRef,
  type InjectionKey,
  type Plugin,
} from "vue";
import { colors, Dark, setCssVar } from "quasar";
import { resolveTheme, themes } from "@/domain/theme";
import type { ThemeConf, ThemeSetting } from "@/type/preload";
import { assertNonNullable } from "@/type/utility";

type ThemeService = {
  readonly currentTheme: Readonly<ComputedRef<ThemeConf>>;
  readonly isDark: Readonly<ComputedRef<boolean>>;
  readonly availableThemes: readonly ThemeConf[];
  setCurrentTheme: (themeSetting: ThemeSetting) => void;
};

const themeKey: InjectionKey<ThemeService> = Symbol("theme");

const setThemeToCss = (theme: ThemeConf) => {
  for (const [key, color] of Object.entries(theme.colors)) {
    const { r, g, b } = colors.hexToRgb(color);
    document.documentElement.style.setProperty(`--color-${key}`, color);
    document.documentElement.style.setProperty(
      `--color-${key}-rgb`,
      `${r}, ${g}, ${b}`,
    );
  }

  const mixColors: [keyof ThemeConf["colors"], keyof ThemeConf["colors"]][] = [
    ["primary", "background"],
    ["warning", "background"],
  ];
  for (const [color1, color2] of mixColors) {
    const color1Rgb = colors.hexToRgb(theme.colors[color1]);
    const color2Rgb = colors.hexToRgb(theme.colors[color2]);
    const r = Math.trunc((color1Rgb.r + color2Rgb.r) / 2);
    const g = Math.trunc((color1Rgb.g + color2Rgb.g) / 2);
    const b = Math.trunc((color1Rgb.b + color2Rgb.b) / 2);
    document.documentElement.style.setProperty(
      `--color-mix-${color1}-${color2}-rgb`,
      `${r}, ${g}, ${b}`,
    );
  }

  setCssVar("primary", theme.colors.primary);
  setCssVar("warning", theme.colors.warning);
  document.documentElement.setAttribute(
    "is-dark-theme",
    theme.isDark ? "true" : "false",
  );
};

export const themePlugin: Plugin = {
  install(app: App) {
    const scope = effectScope();
    scope.run(() => {
      Dark.set(false);
      const themeState = shallowRef<{
        currentThemeSetting: ThemeSetting;
        currentTheme: ThemeConf;
      }>({
        currentThemeSetting: "Default",
        currentTheme: resolveTheme("Default", Dark.isActive),
      });

      const currentTheme = computed(() => themeState.value.currentTheme);
      const isDark = computed(() => themeState.value.currentTheme.isDark);

      const applyThemeToRenderer = (themeSetting: ThemeSetting) => {
        const configuredTheme = resolveTheme(themeSetting, Dark.isActive);
        if (themeSetting === "system") {
          Dark.set("auto");
        } else {
          Dark.set(configuredTheme.isDark);
        }
        const resolvedTheme = resolveTheme(themeSetting, Dark.isActive);
        setThemeToCss(resolvedTheme);
        themeState.value = {
          currentThemeSetting: themeSetting,
          currentTheme: resolvedTheme,
        };
      };

      setThemeToCss(themeState.value.currentTheme);

      watch(
        () => Dark.isActive,
        (isDark) => {
          if (themeState.value.currentThemeSetting !== "system") return;
          const resolvedTheme = resolveTheme("system", isDark);
          setThemeToCss(resolvedTheme);
          themeState.value = {
            currentThemeSetting: "system",
            currentTheme: resolvedTheme,
          };
        },
      );

      const service: ThemeService = {
        currentTheme,
        isDark,
        availableThemes: themes,
        setCurrentTheme: applyThemeToRenderer,
      };
      app.provide(themeKey, service);
      app.onUnmount(() => {
        scope.stop();
        if (themeState.value.currentThemeSetting === "system") {
          Dark.set(Dark.isActive);
        }
      });
    });
  },
};

/** テーマサービスを取得する */
export const useTheme = (): ThemeService => {
  const theme = inject(themeKey);
  assertNonNullable(theme, "テーマサービスが提供されていません");
  return theme;
};
