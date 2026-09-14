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
import { resolveTheme, themes } from "@/domain/theme";
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
      const themeState = shallowRef<{
        currentThemeSetting: ThemeSetting;
        currentTheme: ThemeConf;
      } | null>(null);

      const currentTheme = computed(() => {
        const state = themeState.value;
        assertNonNullable(state, "テーマが設定されていません");
        return state.currentTheme;
      });
      const isDark = computed(() => currentTheme.value.isDark);

      const applyThemeToRenderer = (themeSetting: ThemeSetting) => {
        const configuredTheme = resolveTheme(
          themeSetting,
          Dark.isActive,
          availableThemes.value,
        );
        if (themeSetting === "System") {
          Dark.set("auto");
        } else {
          Dark.set(configuredTheme.isDark);
        }
        const resolvedTheme = resolveTheme(
          themeSetting,
          Dark.isActive,
          availableThemes.value,
        );
        setThemeToCss(resolvedTheme);
        themeState.value = {
          currentThemeSetting: themeSetting,
          currentTheme: resolvedTheme,
        };
      };

      // FIXME: Welcome画面は保存テーマの取得前に描画されるため、初期CSS変数としてDefaultを適用する。
      // 初期テーマを描画前に渡せるようになったら削除する。
      setThemeToCss(resolveTheme("Default", false, availableThemes.value));

      watch(
        () => Dark.isActive,
        (isDark) => {
          if (themeState.value?.currentThemeSetting !== "System") return;
          const resolvedTheme = resolveTheme(
            "System",
            isDark,
            availableThemes.value,
          );
          setThemeToCss(resolvedTheme);
          themeState.value = {
            currentThemeSetting: "System",
            currentTheme: resolvedTheme,
          };
        },
      );

      /**
       * 選択可能なテーマをセットする。
       * NOTE: カスタムテーマが導入された場合を見越して残している。
       */
      const setAvailableThemes = (newAvailableThemes: ThemeConf[]) => {
        availableThemes.value = newAvailableThemes;
        if (themeState.value != null) {
          applyThemeToRenderer(themeState.value.currentThemeSetting);
        }
      };

      const themeManager: ThemeManager = {
        currentTheme,
        isDark,
        availableThemes,
        setCurrentTheme: applyThemeToRenderer,
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
