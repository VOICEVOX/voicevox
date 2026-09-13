import { mount } from "@vue/test-utils";
import { Quasar, Dark } from "quasar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import {
  createThemePlugin,
  useTheme,
  useThemeSetting,
} from "@/plugins/themePlugin";
import type { NativeThemeType, ThemeSetting } from "@/type/preload";
import { assertNonNullable } from "@/type/utility";

type ThemePluginOptions = Parameters<typeof createThemePlugin>[0];
type ThemeService = ReturnType<typeof useTheme>;
type ThemeSettingService = ReturnType<typeof useThemeSetting>;

class TestMediaQueryList {
  matches = false;
  readonly media = "(prefers-color-scheme: dark)";
  private readonly listeners = new Set<() => void>();

  addListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  setMatches(matches: boolean): void {
    this.matches = matches;
    for (const listener of this.listeners) {
      listener();
    }
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

const mountedWrappers: Array<{ unmount: () => void }> = [];
let mediaQuery: TestMediaQueryList;

const mountWritable = (options: ThemePluginOptions) => {
  let themeService: ThemeService | undefined;
  let settingService: ThemeSettingService | undefined;
  const component = defineComponent({
    setup() {
      themeService = useTheme();
      settingService = useThemeSetting();
      return () => h("div");
    },
  });
  const wrapper = mount(component, {
    global: {
      plugins: [Quasar, createThemePlugin(options)],
    },
  });
  mountedWrappers.push(wrapper);
  assertNonNullable(themeService, "テーマサービスが提供されていません");
  assertNonNullable(settingService, "テーマ設定サービスが提供されていません");
  return { wrapper, theme: themeService, setting: settingService };
};

const mountReadonly = (options: ThemePluginOptions) => {
  let themeService: ThemeService | undefined;
  const component = defineComponent({
    setup() {
      themeService = useTheme();
      return () => h("div");
    },
  });
  const wrapper = mount(component, {
    global: {
      plugins: [Quasar, createThemePlugin(options)],
    },
  });
  mountedWrappers.push(wrapper);
  assertNonNullable(themeService, "テーマサービスが提供されていません");
  return { wrapper, theme: themeService };
};

beforeEach(() => {
  Dark.set(false);
  mediaQuery = new TestMediaQueryList();
  vi.stubGlobal("matchMedia", () => mediaQuery);
  document.documentElement.style.cssText = "";
  document.documentElement.removeAttribute("is-dark-theme");
  document.body.className = "";
  document.body.style.cssText = "";
});

afterEach(() => {
  for (const wrapper of mountedWrappers) {
    wrapper.unmount();
  }
  mountedWrappers.length = 0;
  Dark.set(false);
  vi.unstubAllGlobals();
});

const initialThemes = [
  {
    loaded: "Default",
    effective: "Default",
    isDark: false,
    native: "light",
  },
  {
    loaded: "Dark",
    effective: "Dark",
    isDark: true,
    native: "dark",
  },
  {
    loaded: "system",
    effective: "Default",
    isDark: false,
    native: "system",
  },
] satisfies ReadonlyArray<{
  loaded: ThemeSetting;
  effective: "Default" | "Dark";
  isDark: boolean;
  native: NativeThemeType;
}>;

describe("themePlugin", () => {
  it.each(initialThemes)(
    "保存値 $loaded の初期化で保存しない",
    async ({ loaded, effective, isDark, native }) => {
      const load = vi.fn<() => Promise<unknown>>().mockResolvedValue(loaded);
      const save = vi
        .fn<(themeSetting: ThemeSetting) => Promise<void>>()
        .mockResolvedValue(undefined);
      const setNativeTheme = vi
        .fn<(source: NativeThemeType) => Promise<void>>()
        .mockResolvedValue(undefined);
      const { theme } = mountWritable({
        type: "persistent",
        load,
        save,
        setNativeTheme,
      });

      await theme.initialize();
      await nextTick();

      expect(load).toHaveBeenCalledTimes(1);
      expect(save).not.toHaveBeenCalled();
      expect(setNativeTheme).toHaveBeenCalledTimes(1);
      expect(setNativeTheme).toHaveBeenCalledWith(native);
      expect(theme.currentThemeSetting.value).toBe(loaded);
      expect(theme.currentTheme.value.name).toBe(effective);
      expect(theme.isDark.value).toBe(isDark);
      expect(
        document.documentElement.style.getPropertyValue("--color-background"),
      ).toBe(isDark ? "#1F1F1F" : "#FFFFFF");
      expect(document.documentElement.getAttribute("is-dark-theme")).toBe(
        isDark ? "true" : "false",
      );
    },
  );

  it("systemはOS変更に追従し固定テーマは追従しない", async () => {
    const save = vi
      .fn<(themeSetting: ThemeSetting) => Promise<void>>()
      .mockResolvedValue(undefined);
    const setNativeTheme = vi
      .fn<(source: NativeThemeType) => Promise<void>>()
      .mockResolvedValue(undefined);
    const { theme, setting } = mountWritable({
      type: "persistent",
      load: async () => "system",
      save,
      setNativeTheme,
    });

    await theme.initialize();
    expect(mediaQuery.listenerCount).toBe(1);

    mediaQuery.setMatches(true);
    await nextTick();
    expect(theme.currentThemeSetting.value).toBe("system");
    expect(theme.currentTheme.value.name).toBe("Dark");
    expect(theme.isDark.value).toBe(true);
    expect(save).not.toHaveBeenCalled();

    mediaQuery.setMatches(false);
    await nextTick();
    expect(theme.currentTheme.value.name).toBe("Default");
    expect(theme.isDark.value).toBe(false);
    expect(save).not.toHaveBeenCalled();

    await setting.setCurrentTheme("Dark");
    expect(save).toHaveBeenCalledWith("Dark");
    expect(mediaQuery.listenerCount).toBe(0);

    mediaQuery.setMatches(false);
    mediaQuery.setMatches(true);
    await nextTick();
    expect(theme.currentThemeSetting.value).toBe("Dark");
    expect(theme.currentTheme.value.name).toBe("Dark");
    expect(theme.isDark.value).toBe(true);

    await setting.setCurrentTheme("system");
    expect(save).toHaveBeenLastCalledWith("system");
    expect(mediaQuery.listenerCount).toBe(1);

    mediaQuery.setMatches(false);
    await nextTick();
    expect(theme.currentThemeSetting.value).toBe("system");
    expect(theme.currentTheme.value.name).toBe("Default");

    mediaQuery.setMatches(true);
    await nextTick();
    expect(theme.currentThemeSetting.value).toBe("system");
    expect(theme.currentTheme.value.name).toBe("Dark");
  });

  it("保存後に画面とnativeを更新する", async () => {
    const events: string[] = [];
    const save = vi
      .fn<(themeSetting: ThemeSetting) => Promise<void>>()
      .mockResolvedValue(undefined);
    const setNativeTheme = vi
      .fn<(source: NativeThemeType) => Promise<void>>()
      .mockResolvedValue(undefined);
    const { theme, setting } = mountWritable({
      type: "persistent",
      load: async () => "Default",
      save,
      setNativeTheme,
    });

    await theme.initialize();
    save.mockImplementation(async (themeSetting) => {
      events.push("save");
      expect(themeSetting).toBe("Dark");
      expect(theme.currentThemeSetting.value).toBe("Default");
      expect(document.documentElement.getAttribute("is-dark-theme")).toBe(
        "false",
      );
    });
    setNativeTheme.mockImplementation(async (source) => {
      events.push("native");
      expect(source).toBe("dark");
      expect(theme.currentThemeSetting.value).toBe("Dark");
      expect(document.documentElement.getAttribute("is-dark-theme")).toBe(
        "true",
      );
    });

    await setting.setCurrentTheme("Dark");

    expect(events).toEqual(["save", "native"]);
    expect(theme.currentTheme.value.name).toBe("Dark");
    expect(
      document.documentElement.style.getPropertyValue("--color-background"),
    ).toBe("#1F1F1F");
  });

  it("保存失敗時は画面を変更せずnative失敗は伝播する", async () => {
    const saveError = new Error("保存に失敗しました");
    const save = vi
      .fn<(themeSetting: ThemeSetting) => Promise<void>>()
      .mockRejectedValue(saveError);
    const setNativeTheme = vi
      .fn<(source: NativeThemeType) => Promise<void>>()
      .mockResolvedValue(undefined);
    const saveFailure = mountWritable({
      type: "persistent",
      load: async () => "Default",
      save,
      setNativeTheme,
    });
    await saveFailure.theme.initialize();

    await expect(saveFailure.setting.setCurrentTheme("Dark")).rejects.toBe(
      saveError,
    );
    expect(saveFailure.theme.currentThemeSetting.value).toBe("Default");
    expect(document.documentElement.getAttribute("is-dark-theme")).toBe(
      "false",
    );
    expect(setNativeTheme).toHaveBeenCalledTimes(1);

    const nativeError = new Error("native設定に失敗しました");
    const nativeSave = vi
      .fn<(themeSetting: ThemeSetting) => Promise<void>>()
      .mockResolvedValue(undefined);
    const nativeSetting = vi
      .fn<(source: NativeThemeType) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(nativeError);
    const nativeFailure = mountWritable({
      type: "persistent",
      load: async () => "Default",
      save: nativeSave,
      setNativeTheme: nativeSetting,
    });
    await nativeFailure.theme.initialize();

    await expect(nativeFailure.setting.setCurrentTheme("Dark")).rejects.toBe(
      nativeError,
    );
    expect(nativeFailure.theme.currentThemeSetting.value).toBe("Dark");
    expect(document.documentElement.getAttribute("is-dark-theme")).toBe("true");
  });

  it("保存待ちの設定変更をFIFOで適用し待機中のOS変更を反映する", async () => {
    const pendingSaves: Array<{
      setting: ThemeSetting;
      resolve: () => void;
    }> = [];
    const save = vi.fn((setting: ThemeSetting) => {
      const deferred = Promise.withResolvers<void>();
      pendingSaves.push({
        setting,
        resolve: () => deferred.resolve(),
      });
      return deferred.promise;
    });
    const setNativeTheme = vi
      .fn<(source: NativeThemeType) => Promise<void>>()
      .mockResolvedValue(undefined);
    const { theme, setting } = mountWritable({
      type: "persistent",
      load: async () => "system",
      save,
      setNativeTheme,
    });

    await theme.initialize();
    const first = setting.setCurrentTheme("system");
    await vi.waitFor(() => {
      expect(pendingSaves).toHaveLength(1);
    });

    mediaQuery.setMatches(true);
    await nextTick();
    expect(theme.currentThemeSetting.value).toBe("system");
    expect(theme.currentTheme.value.name).toBe("Dark");
    expect(document.documentElement.getAttribute("is-dark-theme")).toBe("true");

    const second = setting.setCurrentTheme("Default");
    expect(pendingSaves).toHaveLength(1);
    pendingSaves[0].resolve();
    await vi.waitFor(() => {
      expect(pendingSaves).toHaveLength(2);
    });
    expect(pendingSaves.map(({ setting: value }) => value)).toEqual([
      "system",
      "Default",
    ]);
    expect(theme.currentThemeSetting.value).toBe("system");
    expect(theme.currentTheme.value.name).toBe("Dark");

    pendingSaves[1].resolve();
    await Promise.all([first, second]);
    expect(theme.currentThemeSetting.value).toBe("Default");
    expect(theme.currentTheme.value.name).toBe("Default");
    expect(document.documentElement.getAttribute("is-dark-theme")).toBe(
      "false",
    );
  });

  it("readonlyは読込とOS追従だけを行いunmount後に監視しない", async () => {
    const { wrapper, theme } = mountReadonly({
      type: "readonly",
      load: async () => "system",
    });

    await theme.initialize();
    mediaQuery.setMatches(true);
    await nextTick();
    expect(theme.currentThemeSetting.value).toBe("system");
    expect(theme.currentTheme.value.name).toBe("Dark");
    expect(mediaQuery.listenerCount).toBe(1);

    wrapper.unmount();
    expect(mediaQuery.listenerCount).toBe(0);

    mediaQuery.setMatches(false);
    await nextTick();
    expect(theme.currentThemeSetting.value).toBe("system");
    expect(theme.currentTheme.value.name).toBe("Dark");
    expect(document.documentElement.getAttribute("is-dark-theme")).toBe("true");
  });
});
