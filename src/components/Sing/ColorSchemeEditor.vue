<template>
  <div class="color-scheme-editor">
    <!-- 型定義などをくわせたChatGPTの出力ほぼそのまま... -->
    <!-- バカ重い... -->
    <h2>カラースキームエディタ</h2>
    <!-- スキーマ選択 -->
    <div class="schema-selector">
      <label for="schema-select">スキーマ選択:</label>
      <select
        id="schema-select"
        v-model="selectedSchemaName"
        @change="onSchemaChange"
      >
        <option
          v-for="schema in availableColorSchemeConfigs"
          :key="schema.name"
          :value="schema.name"
        >
          {{ schema.displayName }}
        </option>
      </select>
    </div>

    <!-- ベースカラーの編集 -->
    <div class="base-colors">
      <h3>ベースカラー</h3>
      <div v-for="role in allColorRoles" :key="role" class="color-picker">
        <label>{{ role }}:</label>
        <input
          type="color"
          :value="getHexColor(getBaseColor(role))"
          @input="
            updateBaseColor(role, $event.target ? $event.target.value : '')
          "
        />
        <span>{{ role in localConfig.baseColors ? "" : "(生成)" }}</span>
      </div>
    </div>

    <!-- エイリアスカラーの表示と編集 -->
    <div
      v-if="localConfig.aliasColors && localConfig.aliasColors.length > 0"
      class="alias-colors"
    >
      <h3>エイリアスカラー</h3>
      <div
        v-for="alias in localConfig.aliasColors"
        :key="alias.name"
        class="alias-color"
      >
        <h4>{{ alias.displayName }}</h4>
        <div class="alias-role-selector">
          <label>ベースカラー:</label>
          <select v-model="alias.role" @change="updateConfig">
            <option v-for="role in allColorRoles" :key="role" :value="role">
              {{ role }}
            </option>
          </select>
        </div>
        <div class="alias-shade-slider">
          <label>Light Shade:</label>
          <input
            v-model.number="alias.lightShade"
            type="range"
            min="0"
            max="1"
            step="0.01"
            @input="updateConfig"
          />
          <span>{{ alias.lightShade.toFixed(2) }}</span>
        </div>
        <div class="alias-shade-slider">
          <label>Dark Shade:</label>
          <input
            v-model.number="alias.darkShade"
            type="range"
            min="0"
            max="1"
            step="0.01"
            @input="updateConfig"
          />
          <span>{{ alias.darkShade.toFixed(2) }}</span>
        </div>
        <div class="alias-color-preview">
          <div
            class="color-box"
            :style="{ backgroundColor: getAliasColorPreview(alias, 'light') }"
          ></div>
          <div
            class="color-box"
            :style="{ backgroundColor: getAliasColorPreview(alias, 'dark') }"
          ></div>
        </div>
      </div>
    </div>

    <!-- カスタムカラーの追加と編集 -->
    <div class="custom-colors">
      <h3>カスタムカラー</h3>
      <div
        v-for="custom in localConfig.customColors"
        :key="custom.name"
        class="custom-color"
      >
        <label>{{ custom.displayName }}:</label>
        <input
          type="color"
          :value="getHexColor(custom.color)"
          @input="
            updateCustomColor(
              custom.name,
              $event.target ? $event.target.value : '',
            )
          "
        />
      </div>
      <button @click="addCustomColor">カスタムカラーを追加</button>
    </div>

    <div class="color-palettes">
      <h3>カラーパレット</h3>
      <div v-for="role in allColorRoles" :key="role" class="palette">
        <h4>{{ role }}</h4>
        <div class="palette-colors">
          <div
            v-for="shade in paletteShades"
            :key="shade"
            class="palette-color"
            :style="{ backgroundColor: getPaletteColor(role, shade) }"
            :title="`${role} ${shade}: ${getPaletteColor(role, shade)}`"
          ></div>
        </div>
      </div>
      <!-- カスタムカラーのパレット -->
      <div
        v-for="custom in localConfig.customColors"
        :key="custom.name"
        class="palette"
      >
        <h4>{{ custom.displayName }}</h4>
        <div class="palette-colors">
          <div
            v-for="shade in paletteShades"
            :key="shade"
            class="palette-color"
            :style="{ backgroundColor: getCustomPaletteColor(custom, shade) }"
            :title="`${custom.name} ${shade}: ${getCustomPaletteColor(custom, shade)}`"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Color from "colorjs.io";
import { useStore } from "@/store";
import { useColorScheme } from "@/composables/useColorScheme";
import {
  ColorSchemeConfig,
  ColorRole,
  AliasColorConfig,
  CustomColorConfig,
} from "@/sing/colorScheme/types";
import { PALETTE_SHADES } from "@/sing/colorScheme/constants";

const store = useStore();
const { currentColorScheme, availableColorSchemeConfigs } = useColorScheme();

const selectedSchemaName = ref(currentColorScheme.value.name);
const localConfig = ref<ColorSchemeConfig>(
  safeClone(currentColorScheme.value.config),
);

function safeClone<T>(obj: T): T {
  if (obj == null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(safeClone) as T;
  }

  const result = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = safeClone(obj[key]);
    }
  }
  return result;
}

const allColorRoles = computed<ColorRole[]>(() => {
  const roles: ColorRole[] = [
    "primary",
    "secondary",
    "tertiary",
    "error",
    "neutral",
    "neutralVariant",
  ];
  if (localConfig.value.baseColors) {
    (Object.keys(localConfig.value.baseColors) as ColorRole[]).forEach(
      (role) => {
        if (!roles.includes(role)) {
          roles.push(role);
        }
      },
    );
  }
  return roles;
});

const getHexColor = (oklchColor: string): string => {
  const color = new Color(oklchColor);
  return color.to("srgb").toString({ format: "hex" });
};

const getBaseColor = (role: ColorRole): string => {
  if (localConfig.value.baseColors && localConfig.value.baseColors[role]) {
    return localConfig.value.baseColors[role];
  }
  // 生成されるカラーの場合、適切なデフォルト値を返す
  switch (role) {
    case "secondary":
      return "oklch(0.5 0.05 0)";
    case "tertiary":
      return "oklch(0.5 0.15 60)";
    case "neutral":
      return "oklch(0.5 0.002 0)";
    case "neutralVariant":
      return "oklch(0.5 0.02 0)";
    default:
      return localConfig.value.baseColors?.primary || "oklch(0.5 0.2 0)";
  }
};

const getAliasColorPreview = (
  alias: AliasColorConfig,
  mode: "light" | "dark",
): string => {
  const baseColor = new Color(getBaseColor(alias.role));
  const shade = mode === "light" ? alias.lightShade : alias.darkShade;
  const adjustedColor = baseColor.oklch;
  adjustedColor.l = shade;
  return new Color("oklch", [
    adjustedColor.l,
    adjustedColor.c,
    adjustedColor.h,
  ]).toString();
};

const updateConfig = () => {
  store.dispatch("SET_COLOR_SCHEME", {
    colorSchemeConfig: safeClone(localConfig.value),
  });
};

const onSchemaChange = () => {
  const newConfig = availableColorSchemeConfigs.value.find(
    (config) => config.name === selectedSchemaName.value,
  );
  if (newConfig) {
    localConfig.value = safeClone(newConfig);
    updateConfig();
  }
};

const updateBaseColor = (role: ColorRole, hexColor: string) => {
  const color = new Color(hexColor);
  const oklchColor = color.to("oklch");
  if (!localConfig.value.baseColors) {
    localConfig.value.baseColors = {};
  }
  localConfig.value.baseColors[role] =
    `oklch(${oklchColor.l} ${oklchColor.c} ${oklchColor.h})`;
  updateConfig();
};

const updateCustomColor = (name: string, hexColor: string) => {
  const customColorIndex =
    localConfig.value.customColors?.findIndex((c) => c.name === name) ?? -1;
  if (customColorIndex !== -1 && localConfig.value.customColors) {
    const color = new Color(hexColor);
    const oklchColor = color.to("oklch");
    localConfig.value.customColors[customColorIndex].color =
      `oklch(${oklchColor.l} ${oklchColor.c} ${oklchColor.h})`;
    updateConfig();
  }
};

const addCustomColor = () => {
  const newCustomColor: CustomColorConfig = {
    name: `custom${localConfig.value.customColors?.length ?? 0}`,
    displayName: `カスタム ${localConfig.value.customColors?.length ?? 0}`,
    color: "oklch(0.5 0.2 0)",
    role: "custom",
  };
  localConfig.value.customColors = [
    ...(localConfig.value.customColors ?? []),
    newCustomColor,
  ];
  updateConfig();
};

const paletteShades = PALETTE_SHADES;

const getPaletteColor = (role: ColorRole, shade: number): string => {
  const baseColor = new Color(getBaseColor(role));
  const adjustedColor = baseColor.oklch;
  adjustedColor.l = shade;
  return new Color("oklch", [
    adjustedColor.l,
    adjustedColor.c,
    adjustedColor.h,
  ]).toString();
};

const getCustomPaletteColor = (
  custom: CustomColorConfig,
  shade: number,
): string => {
  const baseColor = new Color(custom.color);
  const adjustedColor = baseColor.oklch;
  adjustedColor.l = shade;
  return new Color("oklch", [
    adjustedColor.l,
    adjustedColor.c,
    adjustedColor.h,
  ]).toString();
};

// Watch for changes in the currentColorScheme and update localConfig
watch(
  () => currentColorScheme.value,
  (newValue) => {
    localConfig.value = safeClone(newValue.config);
  },
  { deep: true },
);
</script>

<style scoped lang="scss">
.color-scheme-editor {
  border-radius: 16px 0 0 16px;
  padding: 24px;
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  height: 100%;
  opacity: 0;
  overflow-y: auto;
  position: fixed;
  top: 120px;
  right: 0;
  transition: opacity 0.3s ease-in-out;
  width: 25%;
  max-height: calc(100vh - 160px);

  &:hover {
    opacity: 1;
  }

  h2,
  h3,
  h4 {
    font-size: 1rem;
    color: var(--md-sys-color-on-surface-variant);
  }

  .schema-selector,
  .base-colors,
  .alias-colors,
  .custom-colors,
  .color-palettes {
    margin-bottom: 16px;
  }

  .color-picker,
  .alias-color,
  .custom-color {
    display: flex;
    align-items: center;
    margin-bottom: 10px;

    label {
      margin-right: 10px;
      min-width: 120px;
    }

    span {
      margin-left: 10px;
      font-size: 0.8em;
      color: var(--md-sys-color-on-surface-variant);
    }
  }

  .alias-color {
    flex-direction: column;
    align-items: flex-start;
    border: 1px solid var(--md-sys-color-outline);
    padding: 10px;
    margin-bottom: 20px;

    h4 {
      margin-top: 0;
    }

    .alias-role-selector,
    .alias-shade-slider {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      width: 100%;

      label {
        min-width: 100px;
      }

      select,
      input[type="range"] {
        flex-grow: 1;
      }

      span {
        min-width: 40px;
        text-align: right;
      }
    }

    .alias-color-preview {
      display: flex;
      width: 100%;

      .color-box {
        width: 50%;
        height: 30px;
        border: 1px solid var(--md-sys-color-outline);
      }
    }
  }

  .palette {
    margin-bottom: 15px;

    .palette-colors {
      display: flex;
      flex-wrap: wrap;

      .palette-color {
        width: 30px;
        height: 30px;
        margin: 2px;
        border: 1px solid var(--md-sys-color-outline);
      }
    }
  }

  button {
    background-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border: none;
    padding: 10px 15px;
    cursor: pointer;
    border-radius: 4px;

    &:hover {
      background-color: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }
  }
}
</style>
