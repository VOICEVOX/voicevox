import { computed, watch } from "vue";
import { useStore } from "@/store";
import { ColorSchemeConfig, ColorScheme } from "@/type/preload";
import { colorSchemeToCssVariables, arrayFromRgba } from "@/helpers/colors";

export function useColorScheme() {
  const store = useStore();

  const colorSchemeConfig = computed<ColorSchemeConfig | undefined>(
    () =>
      store.state.colorSchemeSetting.currentColorScheme?.config ?? undefined,
  );

  const availableColorSchemeConfigs = computed<ColorSchemeConfig[]>(
    () => store.state.colorSchemeSetting.availableColorSchemeConfigs,
  );

  const currentColorScheme = computed<ColorScheme | undefined>(
    () => store.state.colorSchemeSetting.currentColorScheme,
  );

  const isDarkMode = computed({
    get: () => colorSchemeConfig.value?.isDark ?? false,
    set: (value: boolean) => updateColorScheme({ isDark: value }),
  });

  const updateColorScheme = async (
    partialConfig: Partial<ColorSchemeConfig>,
  ) => {
    if (!colorSchemeConfig.value) return;
    const newConfig = { ...colorSchemeConfig.value, ...partialConfig };
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

  const systemColorsRgba = computed(() => {
    if (!currentColorScheme.value) return {};
    // RGBAに変換
    return Object.entries(currentColorScheme.value.systemColors).reduce(
      (acc, [key, value]) => {
        acc[key] = arrayFromRgba(value);
        return acc;
      },
      {} as Record<string, number[]>,
    );
  });

  const resetColorScheme = () => store.dispatch("INITIALIZE_COLOR_SCHEME");

  const applyColorScheme = () => {
    if (!currentColorScheme.value) return;
    const cssVariables = colorSchemeToCssVariables(currentColorScheme.value);
    Object.entries(cssVariables).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  };

  watch(
    currentColorScheme,
    () => {
      applyColorScheme();
    },
    { deep: true, immediate: true },
  );

  return {
    colorSchemeConfig,
    systemColorsRgba,
    availableColorSchemeConfigs,
    currentColorScheme,
    isDarkMode,
    updateColorScheme,
    selectColorScheme,
    resetColorScheme,
    applyColorScheme,
  };
}
