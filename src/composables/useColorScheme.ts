import { computed } from "vue";
import Color from "colorjs.io";
import { useStore } from "@/store";
import { ColorSchemeConfig, ColorScheme } from "@/sing/colorScheme/types";

export function useColorScheme() {
  const store = useStore();

  const isDarkMode = computed<boolean>(
    () =>
      store.state.themeSetting.availableThemes.find(
        (theme) => theme.name === store.state.themeSetting.currentTheme,
      )?.isDark,
  );

  const currentColorScheme = computed<ColorScheme>(
    () => store.state.colorSchemeSetting.currentColorScheme,
  );

  const availableColorSchemeConfigs = computed<ColorSchemeConfig[]>(
    () => store.state.colorSchemeSetting.availableColorSchemeConfigs,
  );

  const updateColorScheme = async (
    partialConfig: Partial<ColorSchemeConfig>,
  ) => {
    const newConfig = { ...currentColorScheme.value.config, ...partialConfig };
    await store.dispatch("SET_COLOR_SCHEME", { colorSchemeConfig: newConfig });
  };

  const selectColorScheme = async (selectedSchemeName: string) => {
    const selected = availableColorSchemeConfigs.value.find(
      (scheme) => scheme.name === selectedSchemeName,
    );
    if (selected) {
      await updateColorScheme(selected);
    }
  };

  const getColorFromRole = (
    role: string,
    format: "array" | "hex" | "oklch" | "rgb" = "array",
  ) => {
    const colorSet = currentColorScheme.value.roles[role];
    const colorString = isDarkMode.value ? colorSet.dark : colorSet.light;
    console.log(colorString);
    const colorObj = new Color(colorString);
    if (format === "array") {
      const srcColor = colorObj.to("oklch");
      return [srcColor.l, Number(srcColor.c), Number(srcColor.h)];
    } else if (format === "hex") {
      return colorObj.to("hex");
    } else if (format === "oklch") {
      return colorObj.to("oklch");
    } else if (format === "rgb") {
      // [r, g, b]にしたい
      const srgbColor = colorObj.to("srgb");
      console.log(srgbColor);
      return [srgbColor.r * 255, srgbColor.g * 255, srgbColor.b * 255];
    }
  };

  /*
  const isDarkMode = computed({
    get: () => currentColorScheme.value.config.isDark,
    set: (value: boolean) => updateColorScheme({ isDark: value }),
  });

  const updateColorScheme = async (
    partialConfig: Partial<ColorSchemeConfig>,
  ) => {
    const newConfig = { ...currentColorScheme.value.config, ...partialConfig };
    await store.dispatch("SET_COLOR_SCHEME", { colorSchemeConfig: newConfig });
  };

  const selectColorScheme = async (selectedSchemeName: string) => {
    const selected = availableColorSchemeConfigs.value.find(
      (scheme) => scheme.name === selectedSchemeName,
    );
    if (selected) {
      await updateColorScheme(selected);
    }
  }; */

  return {
    currentColorScheme,
    availableColorSchemeConfigs,
    isDarkMode,
    updateColorScheme,
    selectColorScheme,
    getColorFromRole,
  };
}
