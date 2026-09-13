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
  type Ref,
} from "vue";
import { colors, Dark, setCssVar } from "quasar";
import { resolveTheme, themes } from "@/domain/theme";
import {
  themeSettingSchema,
  type NativeThemeType,
  type ThemeConf,
  type ThemeSetting,
} from "@/type/preload";
import { Mutex } from "@/helpers/mutex";
import { assertNonNullable } from "@/type/utility";

type PersistentThemePluginOptions = {
  type: "persistent";
  load: () => Promise<unknown>;
  save: (themeSetting: ThemeSetting) => Promise<void>;
  setNativeTheme: (source: NativeThemeType) => Promise<void>;
};

type ReadonlyThemePluginOptions = {
  type: "readonly";
  load: () => Promise<unknown>;
};

type ControlledThemePluginOptions = {
  type: "controlled";
  initialTheme: ThemeSetting;
};

type ThemePluginOptions =
  | PersistentThemePluginOptions
  | ReadonlyThemePluginOptions
  | ControlledThemePluginOptions;

type ThemeService = {
  readonly currentThemeSetting: Readonly<Ref<ThemeSetting>>;
  readonly currentTheme: Readonly<ComputedRef<ThemeConf>>;
  readonly isDark: Readonly<ComputedRef<boolean>>;
  readonly availableThemes: readonly ThemeConf[];
  initialize: () => Promise<void>;
};

type ThemeSettingService = {
  setCurrentTheme: (themeSetting: ThemeSetting) => Promise<void>;
};

type ThemeServiceResult =
  | {
      type: "readonly";
      service: ThemeService;
      dispose: () => void;
    }
  | {
      type: "writable";
      service: ThemeService;
      settingService: ThemeSettingService;
      dispose: () => void;
    };

const themeKey: InjectionKey<ThemeService> = Symbol("theme");
const themeSettingKey: InjectionKey<ThemeSettingService> =
  Symbol("themeSetting");

const toNativeTheme = (
  themeSetting: ThemeSetting,
  theme: ThemeConf,
): NativeThemeType => {
  if (themeSetting === "system") return "system";
  return theme.isDark ? "dark" : "light";
};

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

const createThemeService = (
  options: ThemePluginOptions,
): ThemeServiceResult => {
  Dark.set(false);
  const themeState = shallowRef<{
    currentThemeSetting: ThemeSetting;
    currentTheme: ThemeConf;
  }>({
    currentThemeSetting: "Default",
    currentTheme: resolveTheme("Default", Dark.isActive),
  });

  const currentThemeSetting = computed(
    () => themeState.value.currentThemeSetting,
  );
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
    return resolvedTheme;
  };

  setThemeToCss(themeState.value.currentTheme);

  const mutex = new Mutex();

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

  const initialize = async () => {
    await using _lock = await mutex.acquire();
    if (options.type === "controlled") {
      applyThemeToRenderer(options.initialTheme);
      return;
    }

    const loadedThemeSetting = themeSettingSchema.parse(await options.load());
    resolveTheme(loadedThemeSetting, Dark.isActive);
    const resolvedTheme = applyThemeToRenderer(loadedThemeSetting);

    if (options.type === "persistent") {
      await options.setNativeTheme(
        toNativeTheme(loadedThemeSetting, resolvedTheme),
      );
    }
  };

  const dispose = () => {
    if (themeState.value.currentThemeSetting === "system") {
      Dark.set(Dark.isActive);
    }
  };

  const service: ThemeService = {
    currentThemeSetting,
    currentTheme,
    isDark,
    availableThemes: themes,
    initialize,
  };

  if (options.type === "readonly") {
    return { type: "readonly", service, dispose };
  }

  const setCurrentTheme = async (themeSetting: ThemeSetting) => {
    await using _lock = await mutex.acquire();
    const validatedThemeSetting = themeSettingSchema.parse(themeSetting);

    if (options.type === "persistent") {
      await options.save(validatedThemeSetting);
    }

    const resolvedTheme = applyThemeToRenderer(validatedThemeSetting);

    if (options.type === "persistent") {
      await options.setNativeTheme(
        toNativeTheme(validatedThemeSetting, resolvedTheme),
      );
    }
  };

  return {
    type: "writable",
    service,
    settingService: { setCurrentTheme },
    dispose,
  };
};

/** テーマプラグインを作成する */
export const createThemePlugin = (options: ThemePluginOptions): Plugin => ({
  install(app: App) {
    const scope = effectScope();
    const result = scope.run(() => createThemeService(options));
    assertNonNullable(result, "テーマサービスを作成できませんでした");
    app.provide(themeKey, result.service);
    if (result.type === "writable") {
      app.provide(themeSettingKey, result.settingService);
    }
    app.onUnmount(() => {
      scope.stop();
      result.dispose();
    });
  },
});

/** テーマサービスを取得する */
export const useTheme = (): ThemeService => {
  const theme = inject(themeKey);
  assertNonNullable(theme, "テーマサービスが提供されていません");
  return theme;
};

/** テーマ設定サービスを取得する */
export const useThemeSetting = (): ThemeSettingService => {
  const themeSetting = inject(themeSettingKey);
  assertNonNullable(themeSetting, "テーマ設定サービスが提供されていません");
  return themeSetting;
};
