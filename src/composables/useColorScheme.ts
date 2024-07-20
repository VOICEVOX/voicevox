import Color from "colorjs.io";
import { computed } from "vue";
import { useStore } from "@/store";
import { ColorSchemeConfig, ColorScheme, OKLCHCoords } from "@/type/preload";
import { hexFromOklch } from "@/helpers/colors";

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

  const resetColorScheme = () => store.dispatch("INITIALIZE_COLOR_SCHEME");

  const getCssVariables = (): Record<string, string> => {
    const variables: Record<string, string> = {};
    const setVariable = (prefix: string, key: string, value: OKLCHCoords) => {
      variables[`--${prefix}-${key}`] = hexFromOklch(value);
      variables[`--${prefix}-${key}-oklch`] =
        `oklch(${(value[0], value[1], value[2])})`;
    };

    Object.entries(currentColorScheme.value.roles).forEach(([key, value]) =>
      setVariable("color", key, value),
    );
    Object.entries(currentColorScheme.value.palette).forEach(([key, value]) =>
      setVariable("palette", key, value),
    );
    Object.entries(currentColorScheme.value.customColors).forEach(
      ([key, value]) => setVariable("custom", key, value),
    );

    return variables;
  };

  const applyColorSchemeToBody = () => {
    const cssVariables = getCssVariables();
    Object.entries(cssVariables).forEach(([key, value]) => {
      document.body.style.setProperty(key, value);
    });
  };

  // NOTE: 以下とりあえず
  const getColorOklchCoords = (colorName: string): OKLCHCoords => {
    return (
      currentColorScheme.value.roles[colorName] ||
      currentColorScheme.value.palette[colorName] ||
      currentColorScheme.value.customColors[colorName] ||
      ""
    );
  };

  const getColorRgb = (colorName: string): number[] => {
    const oklchCoords = getColorOklchCoords(colorName);
    if (!oklchCoords) return [];
    const color = new Color(
      `oklch(${oklchCoords[0]} ${oklchCoords[1]} ${oklchCoords[2]})`,
    );
    return color.srgb.map((value) => Math.round(value * 255));
  };

  const getColorHex = (colorName: string): string => {
    const oklchCoords = getColorOklchCoords(colorName);
    if (!oklchCoords) return "";
    const color = new Color(
      `oklch(${oklchCoords[0]} ${oklchCoords[1]} ${oklchCoords[2]})`,
    );
    return color.toString({ format: "hex" });
  };

  return {
    currentColorScheme,
    availableColorSchemeConfigs,
    isDarkMode,
    updateColorScheme,
    selectColorScheme,
    resetColorScheme,
    getCssVariables,
    applyColorSchemeToBody,
    getColorOklchCoords,
    getColorRgb,
    getColorHex,
  };
}
