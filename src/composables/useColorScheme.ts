import { computed, ComputedRef } from "vue";
import { useStore } from "@/store";
import {
  OklchColor,
  ColorScheme,
  ColorSchemeConfig,
  ColorRole,
  CustomColorConfig,
} from "@/sing/colorScheme/types";
import { generateColorSchemeFromConfig } from "@/sing/colorScheme/core";
import { oklchToCssString } from "@/sing/colorScheme/util";

export function useColorScheme() {
  const store = useStore();

  const currentColorScheme: ComputedRef<ColorScheme> = computed(() => {
    return store.state.colorSchemeSetting.currentColorScheme;
  });

  const availableColorSchemeConfigs: ComputedRef<ColorSchemeConfig[]> =
    computed(() => {
      return store.state.colorSchemeSetting.availableColorSchemeConfigs || [];
    });

  const isDarkMode: ComputedRef<boolean> = computed(() => {
    return store.state.colorSchemeSetting.isDarkMode || false;
  });

  const setColorScheme = async (colorScheme: ColorScheme): Promise<void> => {
    await store.dispatch("SET_COLOR_SCHEME", {
      colorScheme,
      applyStyles: true,
    });
  };

  const setColorSchemeFromConfig = async (
    config: ColorSchemeConfig,
  ): Promise<void> => {
    const colorScheme = generateColorSchemeFromConfig(config);
    await setColorScheme(colorScheme);
  };

  const selectColorScheme = async (schemeName: string): Promise<void> => {
    const selectedConfig = availableColorSchemeConfigs.value.find(
      (config) => config.name === schemeName,
    );
    if (selectedConfig) {
      const newColorScheme = generateColorSchemeFromConfig(selectedConfig);
      await setColorScheme(newColorScheme);
    } else {
      throw new Error(`Color scheme "${schemeName}" not found`);
    }
  };

  const updateColorScheme = async (
    updates: Partial<ColorSchemeConfig>,
  ): Promise<void> => {
    const currentScheme = currentColorScheme.value;
    if (!currentScheme) {
      throw new Error("No current color scheme to update");
    }
    const updatedConfig = { ...currentScheme.config, ...updates };
    const updatedColorScheme = generateColorSchemeFromConfig(updatedConfig);
    await setColorScheme(updatedColorScheme);
  };

  const addCustomColor = async (name: string, color: string): Promise<void> => {
    const newCustomColor: CustomColorConfig = {
      name,
      displayName: name,
      sourceColor: color,
      asRole: true,
    };
    const currentScheme = currentColorScheme.value;
    if (!currentScheme) {
      throw new Error("No current color scheme");
    }
    const updatedCustomColors = [
      ...(currentScheme.config.customColors || []),
      newCustomColor,
    ];
    await updateColorScheme({ customColors: updatedCustomColors });
  };

  const removeCustomColor = async (name: string): Promise<void> => {
    const currentScheme = currentColorScheme.value;
    if (!currentScheme) {
      throw new Error("No current color scheme to remove custom color from");
    }
    const updatedCustomColors =
      currentScheme.config.customColors?.filter((c) => c.name !== name) || [];
    await updateColorScheme({ customColors: updatedCustomColors });
  };

  const getColorFromRole = (
    role: ColorRole,
    format: "oklch" | "hex" | "rgb" | "p3" = "oklch",
  ): OklchColor | string | null => {
    const currentScheme = currentColorScheme.value;
    if (!currentScheme) {
      return null;
    }
    const colorSet = currentScheme.roles[role];
    if (!colorSet) {
      return null;
    }
    const oklchColor = isDarkMode.value
      ? colorSet.darkShade
      : colorSet.lightShade;
    return format === "oklch"
      ? oklchColor
      : oklchToCssString(oklchColor, format);
  };

  const initializeColorScheme = async (): Promise<void> => {
    await store.dispatch("INITIALIZE_COLOR_SCHEME");
  };

  return {
    currentColorScheme,
    availableColorSchemeConfigs,
    isDarkMode,
    setColorScheme,
    setColorSchemeFromConfig,
    selectColorScheme,
    updateColorScheme,
    addCustomColor,
    removeCustomColor,
    getColorFromRole,
    initializeColorScheme,
  };
}
