<template>
  <div class="color-scheme-editor">
    <section class="section combo-section">
      <SelectRoot
        v-model="selectedScheme"
        class="select-root"
        @update:modelValue="onSchemeChange"
      >
        <SelectTrigger class="select-trigger" aria-label="カラースキームを選択">
          <SelectValue placeholder="カラースキームを選択" />
        </SelectTrigger>

        <SelectPortal>
          <SelectContent
            class="select-content"
            position="popper"
            :sideoffset="5"
          >
            <SelectViewport>
              <SelectGroup class="select-group">
                <SelectItem
                  v-for="scheme in availableColorSchemeConfigs"
                  :key="scheme.name"
                  :value="scheme.name"
                  class="select-item"
                >
                  <SelectItemText>
                    {{ scheme.displayName }}
                  </SelectItemText>
                </SelectItem>
              </SelectGroup>
            </SelectViewport>
          </SelectContent>
        </SelectPortal>
      </SelectRoot>
      <div class="switch-root" style="display: none">
        <label class="switch-label" for="dark-mode">ダークモード</label>
        <SwitchRoot
          id="dark-mode"
          v-model:checked="isDarkMode"
          class="switch-root"
        >
          <SwitchThumb class="switch-thumb" />
        </SwitchRoot>
      </div>
      <button @click="resetCurrentScheme">リセット</button>
    </section>

    <!-- ベースロールカラーとカスタムカラーの表示と変更 -->
    <section class="section">
      <div class="color-grid">
        <div v-for="roleName in baseRoles" :key="roleName" class="color-item">
          <input
            type="color"
            :value="getBaseColorHex(roleName)"
            :title="roleName"
            @input="
              (e) =>
                updateRoleColor(roleName, (e.target as HTMLInputElement).value)
            "
          />
          <span>{{ roleName }}</span>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">カスタムカラー</div>
      <div class="color-grid">
        <div
          v-for="customColor in currentColorScheme.config.customColors"
          :key="customColor.name"
          class="color-item"
        >
          <input
            type="color"
            :value="
              new Color(customColor.color)
                .to('srgb')
                .toString({ format: 'hex' })
            "
            :title="customColor.name"
            @click.prevent
          />
          <span>{{ customColor.name }}</span>
        </div>
      </div>
    </section>

    <!-- エイリアスカラー設定 -->
    <section class="section alias-color-section">
      <div class="section-header" style="margin-bottom: 0">パーツの調整</div>
      <div
        v-for="(aliasColor, index) in currentColorScheme.config.aliasColors"
        :key="`alias-color-${aliasColor.name}-${index}`"
        class="alias-color"
      >
        <label>{{ aliasColor.displayName }}</label>
        <div class="alias-color-controls">
          <SelectRoot
            :modelValue="aliasColor.role"
            class="select-root"
            @update:modelValue="
              (value: string) => updateAliasColorRole(aliasColor.name, value)
            "
          >
            <SelectTrigger class="select-trigger">
              <SelectValue :placeholder="aliasColor.role">
                {{ aliasColor.role }}
              </SelectValue>
            </SelectTrigger>
            <SelectPortal>
              <SelectContent
                class="select-content"
                position="popper"
                :sideoffset="5"
              >
                <SelectViewport>
                  <SelectGroup class="select-group">
                    <SelectItem
                      v-for="role in allRolesIncludingCustom"
                      :key="role"
                      :value="role"
                      class="select-item"
                    >
                      {{ role }}
                    </SelectItem>
                  </SelectGroup>
                </SelectViewport>
              </SelectContent>
            </SelectPortal>
          </SelectRoot>
          <span class="alias-color-value">
            {{ isDarkMode ? aliasColor.darkShade : aliasColor.lightShade }}
          </span>
        </div>
        <SliderRoot
          :modelValue="[
            isDarkMode ? aliasColor.darkShade : aliasColor.lightShade,
          ]"
          class="slider-root"
          :max="1"
          :step="0.01"
          @update:modelValue="
            (value) =>
              updateAliasColorShade(aliasColor.name, value ? value[0] : 0)
          "
        >
          <SliderTrack class="slider-track">
            <SliderRange class="slider-range" />
          </SliderTrack>
          <SliderThumb
            :aria-label="aliasColor.displayName"
            class="slider-thumb"
          />
        </SliderRoot>
      </div>
    </section>

    <section class="section">
      <div class="section-header">カラーパレット</div>
      <div
        v-for="(palette, paletteName) in allPalettes"
        :key="paletteName"
        class="palette"
      >
        <div class="palette-name">{{ paletteName }}</div>
        <div class="palette-colors">
          <div
            v-for="shade in sortedPalettes"
            :key="shade"
            class="palette-color"
            :style="{
              backgroundColor: getColorOklch(palette.shades[shade]),
            }"
          >
            <span
              class="palette-color-text"
              :style="{
                color: shade <= 0.6 ? 'white' : 'black',
              }"
            >
              {{ Math.round(shade * 100) }}
            </span>
          </div>
        </div>
      </div>
    </section>
    <!-- ダウンロードボタン -->
    <section class="section">
      <button @click="downloadColorSchemeConfig">JSONでエクスポート</button>
    </section>
  </div>
</template>

<script setup lang="ts">
import Color from "colorjs.io";
import { ref, computed, onMounted } from "vue";
import {
  SelectRoot,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectTrigger,
  SelectValue,
  SelectViewport,
  SwitchRoot,
  SwitchThumb,
  SliderRoot,
  SliderTrack,
  SliderRange,
  SliderThumb,
} from "radix-vue";
import { useColorScheme } from "@/composables/useColorScheme";
import {
  ColorRole,
  OklchColor,
  ColorSchemeConfig,
  ColorPalette,
  CustomColorConfig,
} from "@/sing/colorScheme/types";
import { cssStringFromOklch } from "@/sing/colorScheme/generator";

const {
  currentColorScheme,
  availableColorSchemeConfigs,
  isDarkMode,
  updateColorScheme,
  selectColorScheme,
  //setDarkMode,
} = useColorScheme();

const selectedScheme = ref(currentColorScheme.value.name);

// 現在のスキームの期設定を保持
const initialSchemeConfig = ref<ColorSchemeConfig | null>(null);

const sortedPalettes = computed(() => {
  return Object.keys(
    currentColorScheme.value.palettes[
      Object.keys(currentColorScheme.value.palettes)[0]
    ].shades,
  )
    .map(Number)
    .sort((a, b) => a - b);
});

// ベースロールの一覧
const baseRoles = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
  "error",
];

// すべてのロールの一覧（ベースロール + カスタムカラー）
const allRolesIncludingCustom = computed(() => {
  const baseRoles = [
    "primary",
    "secondary",
    "tertiary",
    "neutral",
    "neutralVariant",
    "error",
  ];
  const customRoles =
    currentColorScheme.value.config.customColors?.map((cc) => cc.name) || [];
  return [...baseRoles, ...customRoles];
});

// カラースキーム変更
const onSchemeChange = async () => {
  await selectColorScheme(selectedScheme.value);
  initialSchemeConfig.value = JSON.parse(
    JSON.stringify(currentColorScheme.value.config),
  );
};

// テーマ変更(互換性のため既存のテーマ切り替え)
//const onModeChange = (checked: boolean) => {
//setDarkMode(checked);
//};

// 現在のスキームをリセット
const resetCurrentScheme = async () => {
  if (initialSchemeConfig.value) {
    await updateColorScheme(initialSchemeConfig.value);
  }
};

// ベースカラーをHEX形式で取得
const getBaseColorHex = (role: ColorRole): string => {
  const baseColor = currentColorScheme.value.config.baseColors[role];
  if (baseColor) {
    return new Color(baseColor).to("srgb").toString({ format: "hex" });
  }
  // 色が指定されていない場合、パレットから取得
  const palette = currentColorScheme.value.palettes[role];
  if (!palette) {
    return "#000000"; // デフォルト値
  }

  // 70%のシェードを使用（または適切なシェードを選択）
  const color = palette.shades[0.7];
  if (!color) {
    return "#000000"; // デフォルト値
  }

  return new Color("oklch", [...color]).to("srgb").toString({ format: "hex" });
};

// ベースロールカラー更新
const updateRoleColor = async (role: ColorRole, hexColor: string) => {
  const newBaseColors = {
    ...currentColorScheme.value.config.baseColors,
    [role]: new Color(hexColor).to("oklch").toString(),
  };
  await updateColorScheme({ baseColors: newBaseColors });
};

// HEX形式をOKLCHに変換する関数
const hexToOklch = (hexColor: string): OklchColor => {
  const color = new Color(hexColor);
  return color.to("oklch").coords as OklchColor;
};

// OKLCHカラーをCSS文字列に変換
const getColorOklch = (color: OklchColor | string): string => {
  if (typeof color === "string") {
    return color;
  }
  return cssStringFromOklch(color);
};

// カスタムカラー更新
// NOTE: カスタムカラーCRUD機能追加時にカスタムカラーのパレットを更新するために使用
/*
const updateCustomColor = async (index: number, hexColor: string) => {
  const updatedCustomColors = [
    ...(currentColorScheme.value.config.customColors || []),
  ];
  updatedCustomColors[index] = {
    ...updatedCustomColors[index],
    color: new Color(hexColor).to("oklch").toString(),
  };
  await updateColorScheme({ customColors: updatedCustomColors });
}; */

// エイリアスカラーのロール更新
const updateAliasColorRole = async (name: string, value: ColorRole) => {
  const aliasColors = currentColorScheme.value.config.aliasColors ?? [];
  const updatedAliasColors = aliasColors.map((ac) =>
    ac.name === name ? { ...ac, role: value } : ac,
  );
  await updateColorScheme({ aliasColors: updatedAliasColors });
};

// エイリアスカラーの明度更新
const updateAliasColorShade = async (name: string, shade: number) => {
  if (shade == undefined) return;
  const updatedAliasColors =
    currentColorScheme.value.config.aliasColors?.map((ac) =>
      ac.name === name
        ? {
            ...ac,
            [isDarkMode.value ? "darkShade" : "lightShade"]: shade,
          }
        : ac,
    ) ?? [];
  await updateColorScheme({ aliasColors: updatedAliasColors });
};

// ColorSchemeConfigをJSONに変換する関数
const colorSchemeConfigToJSON = (config: ColorSchemeConfig): string => {
  return JSON.stringify(config, null, 2);
};

// JSONをファイルとしてダウンロードする関数
const downloadJSON = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};

// ダウンロードボタンのクリックハンドラ
const downloadColorSchemeConfig = () => {
  const config = currentColorScheme.value.config;
  const jsonContent = colorSchemeConfigToJSON(config);
  const fileName = `${config.name}_color_scheme_config.json`;
  downloadJSON(jsonContent, fileName);
};

// コンポーネントのマウント時に初期設定を保存
onMounted(() => {
  initialSchemeConfig.value = JSON.parse(
    JSON.stringify(currentColorScheme.value.config),
  );
});

const allPalettes = computed(() => {
  const basePalettes = currentColorScheme.value.palettes;
  const customPalettes =
    currentColorScheme.value.config.customColors?.reduce(
      (acc, customColor) => {
        acc[customColor.name] = generateCustomPalette(customColor);
        return acc;
      },
      {} as Record<string, ColorPalette>,
    ) || {};

  return { ...basePalettes, ...customPalettes };
});

// カスタムカラーのパレットを生成する関数
function generateCustomPalette(customColor: CustomColorConfig): ColorPalette {
  const baseColor = hexToOklch(customColor.color);
  const shades = sortedPalettes.value.reduce(
    (acc, shade) => {
      acc[shade] = adjustShade(baseColor, shade);
      return acc;
    },
    {} as Record<number, OklchColor>,
  );

  return { name: customColor.name, shades };
}

// シェードを調整する関数
function adjustShade(baseColor: OklchColor, shade: number): OklchColor {
  const [, c, h] = baseColor;
  const newL = shade;
  return [newL, c, h];
}
</script>

<style scoped>
.color-scheme-editor {
  background: oklch(from var(--scheme-color-surface) l c h / 0.6);
  backdrop-filter: blur(16px);
  border-radius: 1rem 0 0 1rem;
  color: var(--scheme-color-on-surface-container);
  height: calc(100vh - 10rem);
  letter-spacing: -0.0375em;
  font-size: 1rem;
  width: 480px;
  max-width: 40%;
  overflow-y: auto;
  position: fixed;
  right: 0;
  top: 144px;
  height: calc(100vh - 228px);
  font-weight: 500;
  display: grid;
  grid-template-rows: 1fr auto;
  border: 0.25rem solid var(--scheme-color-outline-variant);
  border-right: none;
}

.section {
  border-top: 1px solid var(--scheme-color-outline-variant);
  padding: 1.5rem;

  &:first-child {
    border-top: none;
  }
}

.combo-section {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 1rem;
  align-items: center;
}

.section-header {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: var(--scheme-color-on-surface);
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(48px, 1fr));
  gap: 1rem;
}

.color-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.color-item input[type="color"] {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  background: none;
}

.color-item input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-item input[type="color"]::-webkit-color-swatch {
  border: none;
  border-radius: 50%;
}

.color-item input[type="color"]::-moz-color-swatch {
  border: none;
  border-radius: 50%;
}

.color-item span {
  font-size: 0.75rem;
  text-align: center;
  color: var(--scheme-color-on-surface-variant);
  word-break: break-word;
}

.alias-color-section {
  display: grid;
  gap: 1.5rem;
}

.alias-color {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alias-color label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--scheme-color-on-surface);
}

.alias-color-controls {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 1rem;
  align-items: center;
}

.alias-color-value {
  font-size: 0.875rem;
  color: var(--scheme-color-on-surface-variant);
  min-width: 3em;
  text-align: right;
}

.palette {
  margin-bottom: 0.5rem;
}

.palette-name {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--scheme-color-on-surface);
}

.palette-colors {
  background-color: var(--scheme-color-surface-lowest);
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  gap: 0;
  width: 100%;
}

.palette-color {
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  font-size: 0.625rem;
}

.palette-color-text {
  opacity: 0;
}

button {
  padding: 0.5rem;
  background-color: var(--scheme-color-secondary);
  color: var(--scheme-color-on-secondary);
  border: none;
  border-radius: 1.5rem;
  cursor: pointer;
  line-height: 1;
  font-weight: 500;
  font-size: 0.875rem;
  transition: background-color 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
}

/* radix-vueコンポーネントのスタイル調整(仮: とりあえずみられる形) */
/* Select */
.select-root {
  position: relative;
  width: 100%;
  z-index: 1;
}

.select-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  line-height: 1;
  background-color: var(--scheme-color-surface);
  color: var(--scheme-color-on-surface);
  border: 1px solid var(--scheme-color-outline-variant);
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.16s ease;
}

.select-trigger:hover {
  background: var(--scheme-color-surface-variant);
  border: 1px solid var(--scheme-color-outline);
}

.select-trigger:focus {
  outline: 2px solid var(--scheme-color-primary);
  outline-offset: 2px;
}

.select-content {
  z-index: 1;
}

.select-viewport {
  padding: 0.5rem 0;
  overflow: hidden;
}

.select-group {
  background-color: var(--scheme-color-surface);
  border: 1px solid var(--scheme-color-outline-variant);
  border-radius: 0.25rem;
}

.select-item {
  color: var(--scheme-color-on-surface);
  padding: 0.25rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.select-item:hover {
  background-color: var(--scheme-color-surface-variant);
  color: var(--scheme-color-on-surface-variant);
}

.select-item[data-highlighted] {
  background-color: var(--scheme-color-secondary-container);
  color: var(--scheme-color-on-secondary-container);
}

.select-label {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--scheme-color-on-surface-variant);
}

/* スイッチのスタイル */
.switch-root {
  width: 42px;
  height: 25px;
  background-color: var(--scheme-color-surface-variant);
  border-radius: 9999px;
  position: relative;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
}

.switch-root[data-state="checked"] {
  background-color: var(--scheme-color-primary);
}

.switch-thumb {
  display: block;
  width: 21px;
  height: 21px;
  background-color: white;
  border-radius: 9999px;
  box-shadow: 0 2px 2px var(--scheme-color-shadow);
  transition: transform 100ms;
  transform: translateX(2px);
  will-change: transform;
}

.switch-thumb[data-state="checked"] {
  transform: translateX(19px);
}

.switch-label {
  font-size: 0.875rem;
  color: var(--scheme-color-on-surface);
  margin-right: 0.5rem;
}

/* スライダーのスタイル */
.slider-root {
  position: relative;
  display: flex;
  align-items: center;
  width: 200px;
  height: 24px;
}

.slider-track {
  position: relative;
  height: 4px;
  border-radius: 2px;
}

.slider-range {
  position: absolute;
  background-color: var(--scheme-color-primary);
  height: 100%;
  border-radius: 2px;
  width: 100%;
}

.slider-thumb {
  display: block;
  width: 20px;
  height: 20px;
  background-color: var(--scheme-color-primary);
  border: 0;
  border-radius: 50%;
}

.slider-container {
  width: 200px;
}
</style>
