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
  type ShallowRef,
} from "vue";
import { colors, Dark, setCssVar } from "quasar";
import { getThemeByIsDark, getThemeByName, themes } from "@/domain/theme";
import type { ThemeConf, ThemeSetting } from "@/type/preload";
import { assertNonNullable } from "@/type/utility";

type ThemeManager = {
  readonly currentTheme: Readonly<ComputedRef<ThemeConf>>;
  readonly isDark: Readonly<ComputedRef<boolean>>;
  readonly availableThemes: Readonly<ShallowRef<ThemeConf[]>>;
  setCurrentTheme: (themeSetting: ThemeSetting) => void;
  setAvailableThemes: (themes: ThemeConf[]) => void;
};

const themeKey: InjectionKey<ThemeManager> = Symbol("theme");

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
      const availableThemes = shallowRef<ThemeConf[]>(themes);
      const currentThemeSetting = shallowRef<ThemeSetting | null>(null);

      const currentTheme = computed(() => {
        const themeSetting = currentThemeSetting.value;
        assertNonNullable(themeSetting, "テーマが設定されていません");
        if (themeSetting === "System") {
          return getThemeByIsDark(Dark.isActive, availableThemes.value);
        }
        return getThemeByName(themeSetting, availableThemes.value);
      });
      const isDark = computed(() => currentTheme.value.isDark);

      const setCurrentTheme = (themeSetting: ThemeSetting) => {
        if (themeSetting === "System") {
          Dark.set("auto");
        }
        currentThemeSetting.value = themeSetting;
        const theme = currentTheme.value;
        if (themeSetting !== "System") {
          Dark.set(theme.isDark);
        }
        setThemeToCss(theme);
      };

      watch(
        () => Dark.isActive,
        () => {
          if (currentThemeSetting.value !== "System") return;
          setThemeToCss(currentTheme.value);
        },
      );

      /**
       * 選択可能なテーマをセットする。
       * NOTE: カスタムテーマが導入された場合を見越して残している。
       */
      const setAvailableThemes = (newAvailableThemes: ThemeConf[]) => {
        const themeSetting = currentThemeSetting.value;
        assertNonNullable(themeSetting, "テーマが設定されていません");
        availableThemes.value = newAvailableThemes;
        setCurrentTheme(themeSetting);
      };

      const themeManager: ThemeManager = {
        currentTheme,
        isDark,
        availableThemes,
        setCurrentTheme,
        setAvailableThemes,
      };
      app.provide(themeKey, themeManager);
      app.onUnmount(() => {
        scope.stop();
      });
    });
  },
};

/** テーママネージャーを取得する */
export const useTheme = (): ThemeManager => {
  const theme = inject(themeKey);
  assertNonNullable(theme, "テーママネージャーが提供されていません");
  return theme;
};
