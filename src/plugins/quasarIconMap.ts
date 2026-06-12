import type { GlobalQuasarIconMapFn, QuasarUIConfiguration } from "quasar";

const MATERIAL_SYMBOLS_PREFIXES = ["sym_o_", "sym_r_", "sym_s_"];
const MATERIAL_ICONS_PREFIXES = ["o_", "r_", "s_"];

const MATERIAL_SYMBOL_ALIASES: Record<string, string> = {
  access_time: "schedule",
  add_circle_outline: "add_circle",
  delete_outline: "delete",
  headset: "headphones",
  help_outline: "help",
  loop: "repeat",
  push_pin: "keep",
};

const isMaterialIconLigatureName = (iconName: string) => {
  return /^[a-z][a-z0-9_]*$/.test(iconName);
};

export const materialSymbolsRoundedIconMap: GlobalQuasarIconMapFn = (
  iconName,
) => {
  if (
    MATERIAL_SYMBOLS_PREFIXES.some((prefix) => iconName.startsWith(prefix))
  ) {
    return;
  }

  if (MATERIAL_ICONS_PREFIXES.some((prefix) => iconName.startsWith(prefix))) {
    return { icon: `sym_r_${iconName.slice(2)}` };
  }

  if (!isMaterialIconLigatureName(iconName)) {
    return;
  }

  return { icon: `sym_r_${MATERIAL_SYMBOL_ALIASES[iconName] ?? iconName}` };
};

export const withMaterialSymbolsRoundedIconMap = (
  config: QuasarUIConfiguration,
): QuasarUIConfiguration =>
  ({
    ...config,
    iconMapFn: materialSymbolsRoundedIconMap,
  }) as QuasarUIConfiguration;
