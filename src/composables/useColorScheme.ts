import { computed } from "vue";
import Color from "colorjs.io";
import { useStore } from "@/store";
import {
  ColorSchemeConfig,
  ColorScheme,
  OklchColor,
} from "@/sing/colorScheme/types";

export function useColorScheme() {
  const store = useStore();

  const isDarkMode = computed<boolean>(
    () => store.state.themeSetting.currentTheme === "Dark",
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
    store.commit("SET_COLOR_SCHEME", { colorSchemeConfig: newConfig });
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
  ): OklchColor | string | number[] => {
    const colorSet = currentColorScheme.value.roles[role];
    const oklchColor: OklchColor = isDarkMode.value
      ? colorSet.dark
      : colorSet.light;

    switch (format) {
      case "array":
        return oklchColor;
      case "hex":
        return new Color("hex", [...oklchColor]).toString();
      case "oklch":
        return new Color("oklch", [...oklchColor]).toString();
      case "rgb": {
        const color = new Color("oklch", [...oklchColor]);
        const srgbColor = color.to("srgb");
        return [
          Math.round(srgbColor.r * 255),
          Math.round(srgbColor.g * 255),
          Math.round(srgbColor.b * 255),
        ];
      }
      default:
        throw new Error(`Unsupported color format: ${format}`);
    }
  };

  return {
    isDarkMode,
    currentColorScheme,
    availableColorSchemeConfigs,
    updateColorScheme,
    selectColorScheme,
    getColorFromRole,
  };
}
