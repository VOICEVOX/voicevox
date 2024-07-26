/* import Color from "colorjs.io";
import { computed } from "vue";
import { useStore } from "@/store";
import { ColorSchemeConfig, ColorScheme } from "@/type/preload";
import { hexFromOklch } from "@/helpers/colors"; */

import { computed } from "vue";
import { useStore } from "@/store";
import { ColorSchemeConfig, ColorScheme } from "@/helpers/colors";

export function useColorScheme() {
  const store = useStore();

  const currentColorScheme = computed<ColorScheme>(
    () => store.state.colorSchemeSetting.currentColorScheme,
  );

  const availableColorSchemeConfigs = computed<ColorSchemeConfig[]>(
    () => store.state.colorSchemeSetting.availableColorSchemeConfigs,
  );

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
  };

  return {
    currentColorScheme,
    availableColorSchemeConfigs,
    isDarkMode,
    updateColorScheme,
    selectColorScheme,
  };
}
