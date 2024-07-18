<template>
  <div v-if="isShowEditor" class="scheme-editor">
    <div class="editor-content">
      <h2 class="editor-title">
        <QBtn
          icon="close"
          color="secondary"
          variant="flat"
          flat
          rounded
          @click="isShowEditor = false"
        />
        カラースキーム
      </h2>
      <div class="editor-section">
        <label>テーマ</label>
        <select :value="name" class="select-input" @change="handleSchemeChange">
          <option
            v-for="scheme in availableColorSchemeConfigs"
            :key="scheme.name"
            :value="scheme.name"
          >
            {{ scheme.name }}
          </option>
        </select>
      </div>
      <div class="editor-section">
        <button @click="resetColorScheme">リセット</button>
      </div>
      <div class="editor-section">
        <label>ソースカラー</label>
        <input
          :value="sourceColor"
          class="color-input"
          type="color"
          @input="updateSourceColor"
        />
      </div>
      <div class="editor-section">
        <input type="checkbox" :checked="isDarkMode" @change="updateIsDark" />
        ダークテーマ
      </div>
      <div class="editor-section">
        <label>バリエーション</label>
        <select :value="variant" class="select-input" @change="updateVariant">
          <option
            v-for="variantOption in variantOptions"
            :key="variantOption"
            :value="variantOption"
          >
            {{ variantOption }}
          </option>
        </select>
      </div>
      <div class="editor-section">
        <label>
          コントラスト
          {{ contrastLevel.toFixed(2) }}
          <input
            :value="contrastLevel"
            type="range"
            min="-1"
            max="1"
            step="0.05"
            class="range-input"
            @input="updateContrastLevel"
          />
        </label>
      </div>
      <hr />
      <h3>調整</h3>
      <div v-for="color in colorKeys" :key="color" class="editor-section">
        <h4>{{ color.charAt(0).toUpperCase() + color.slice(1) }}</h4>
        <div>
          <label>
            Hex:
            <input
              :value="adjustments[color].hex"
              type="color"
              class="color-input"
              @input="
                (e) =>
                  updateAdjustment(
                    color,
                    'hex',
                    (e.target as HTMLInputElement).value,
                  )
              "
            />
          </label>
        </div>
        <div v-for="prop in ['hue', 'chroma', 'tone']" :key="prop">
          <label>
            {{ prop.charAt(0).toUpperCase() + prop.slice(1) }}:
            {{
              adjustments[color][
                prop as keyof (typeof adjustments)[typeof color]
              ]
            }}
            <input
              :value="
                adjustments[color][
                  prop as keyof (typeof adjustments)[typeof color]
                ]
              "
              type="range"
              :min="prop === 'hue' ? 0 : prop === 'chroma' ? 0 : 0"
              :max="prop === 'hue' ? 360 : prop === 'chroma' ? 150 : 100"
              :step="prop === 'chroma' ? 0.1 : 1"
              class="range-input"
              @input="
                (e) =>
                  updateAdjustment(
                    color,
                    prop as 'hue' | 'chroma' | 'tone',
                    Number((e.target as HTMLInputElement).value),
                  )
              "
            />
          </label>
        </div>
      </div>
      <hr />
      <h3 class="custom-palette-title">カスタムカラー</h3>
      <div
        v-for="(color, index) in customPaletteColors"
        :key="index"
        class="editor-section custom-palette-color"
      >
        <h4>{{ color.name }}</h4>
        <div>
          <label>パレット</label>
          <select
            :value="color.palette"
            class="select-input"
            @change="
              (e) =>
                updateCustomPaletteColor(
                  index,
                  'palette',
                  (e.target as HTMLSelectElement).value,
                )
            "
          >
            <option
              v-for="paletteOption in paletteOptions"
              :key="paletteOption"
              :value="paletteOption"
            >
              {{ paletteOption }}
            </option>
          </select>
        </div>
        <div>
          <label>
            ライト {{ color.lightTone }}
            <input
              :value="color.lightTone"
              type="range"
              min="0"
              max="100"
              step="1"
              class="range-input"
              @input="
                (e) =>
                  updateCustomPaletteColor(
                    index,
                    'lightTone',
                    Number((e.target as HTMLInputElement).value),
                  )
              "
            />
          </label>
        </div>
        <div>
          <label>
            ダーク {{ color.darkTone }}
            <input
              :value="color.darkTone"
              type="range"
              min="0"
              max="100"
              step="1"
              class="range-input"
              @input="
                (e) =>
                  updateCustomPaletteColor(
                    index,
                    'darkTone',
                    Number((e.target as HTMLInputElement).value) || 0,
                  )
              "
            />
          </label>
        </div>
        <div>
          <label>
            <input
              :checked="color.blend"
              type="checkbox"
              @change="
                (e) =>
                  updateCustomPaletteColor(
                    index,
                    'blend',
                    (e.target as HTMLInputElement).checked,
                  )
              "
            />
            ブレンド
          </label>
        </div>
      </div>
      <hr />
      <div class="editor-section">
        <QBtn
          flat
          label="エクスポート"
          color="secondary"
          @click="exportColorScheme"
        />
      </div>
    </div>
  </div>
  <QBtn
    v-if="!isShowEditor"
    class="toggle-button"
    variant="flat"
    flat
    @click="isShowEditor = true"
  >
    カラースキーム
  </QBtn>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useColorScheme } from "@/composables/useColorScheme";
import {
  ColorSchemeConfig,
  ColorSchemeVariant,
  ColorSchemeCorePalettes,
} from "@/type/preload";

const isShowEditor = ref(true);

const {
  colorSchemeConfig,
  availableColorSchemeConfigs,
  isDarkMode,
  updateColorScheme,
  selectColorScheme,
  resetColorScheme,
  applyColorScheme,
} = useColorScheme();

type AdjustmentProperties = {
  [K in ColorSchemeCorePalettes]: {
    hex: string;
    hue: number;
    chroma: number;
    tone: number;
  };
};

const name = computed(() => colorSchemeConfig.value?.name || "");
const sourceColor = computed(() => colorSchemeConfig.value?.sourceColor || "");
const variant = computed(() => colorSchemeConfig.value?.variant || "");
const contrastLevel = computed(
  () => colorSchemeConfig.value?.contrastLevel || 0,
);

const adjustments = computed<AdjustmentProperties>(() => {
  return colorKeys.reduce((acc, color) => {
    acc[color] = {
      hex: colorSchemeConfig.value?.adjustments?.[color]?.hex ?? "#FFFFFF",
      hue: colorSchemeConfig.value?.adjustments?.[color]?.hue ?? 0,
      chroma: colorSchemeConfig.value?.adjustments?.[color]?.chroma ?? 0,
      tone: colorSchemeConfig.value?.adjustments?.[color]?.tone ?? 0,
    };
    return acc;
  }, {} as AdjustmentProperties);
});

const customPaletteColors = computed(
  () => colorSchemeConfig.value?.customPaletteColors || [],
);

const handleSchemeChange = (event: Event) => {
  const selectedValue = (event.target as HTMLSelectElement).value;
  selectColorScheme(selectedValue);
};

const updateSourceColor = (e: Event) => {
  const sourceColor = (e.target as HTMLInputElement).value;
  updateColorScheme({ sourceColor });
};

const updateIsDark = (e: Event) => {
  const isDark = (e.target as HTMLInputElement).checked;
  updateColorScheme({ isDark });
};

const updateVariant = (e: Event) => {
  const variant = (e.target as HTMLSelectElement).value as ColorSchemeVariant;
  updateColorScheme({ variant });
};

const updateContrastLevel = (e: Event) => {
  const contrastLevel = Number((e.target as HTMLInputElement).value);
  updateColorScheme({ contrastLevel });
};

const updateAdjustment = (
  color: ColorSchemeCorePalettes,
  property: "hex" | "hue" | "chroma" | "tone",
  value: number | string,
) => {
  if (!colorSchemeConfig.value) return;
  const newAdjustments = {
    ...colorSchemeConfig.value.adjustments,
    [color]: {
      ...colorSchemeConfig.value.adjustments?.[color],
      [property]: value,
    },
  };

  updateColorScheme({
    adjustments: newAdjustments,
  });
};

const updateCustomPaletteColor = (
  index: number,
  property: keyof ColorSchemeConfig["customPaletteColors"][number],
  value: string | number | boolean,
) => {
  if (!colorSchemeConfig.value?.customPaletteColors) return;
  const customPaletteColors = [...colorSchemeConfig.value.customPaletteColors];
  customPaletteColors[index] = {
    ...customPaletteColors[index],
    [property]: value,
  };
  updateColorScheme({ customPaletteColors });
};

const exportColorScheme = () => {
  if (!colorSchemeConfig.value) return;
  const jsonString = JSON.stringify(colorSchemeConfig.value, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${colorSchemeConfig.value.name}_color-scheme.json`;
  link.click();
};

// 定数
const colorKeys: ColorSchemeCorePalettes[] = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
  "error",
];

const variantOptions: ColorSchemeVariant[] = [
  "content",
  "tonalSpot",
  "neutral",
  "vibrant",
  "expressive",
  "fidelity",
  "monochrome",
  "rainbow",
  "fruitSalad",
];

const paletteOptions: ColorSchemeCorePalettes[] = colorKeys;

// カラースキームが変更されたときにCSSに適用
watch(colorSchemeConfig, applyColorScheme, { immediate: true });
</script>

<style scoped>
h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  padding: 0;
}

h3 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  padding: 0;
}

h4 {
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0;
  padding: 0;
}

.toggle-button {
  position: fixed;
  right: 32px;
  top: 144px;
  z-index: 1;
  padding: 8px 16px;
  background-color: transparent;
  backdrop-filter: blur(10px);
  color: var(--md-sys-color-on-secondary-container);
  border: none;
  border-radius: 20px;
  cursor: pointer;
  opacity: 0.72;
  transition: all 0.2s ease;

  &:hover {
    opacity: 1;
  }
}

.scheme-editor {
  position: fixed;
  top: 144px;
  right: 0;
  width: 300px;
  height: calc(100vh - 184px);
  background-color: rgba(var(--md-sys-color-surface-rgb), 0.8);
  backdrop-filter: blur(10px);
  color: var(--md-sys-color-on-surface);
  border-radius: 20px 0 0 20px;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease;
  overflow-y: auto;
  z-index: 1;
}

.scheme-editor.editor-open {
  right: 0;
}

.editor-content {
  padding: 16px;
}

.editor-title {
  font-size: 1.5rem;
  margin-bottom: 16px;
}

.reset-button {
  background-color: var(--md-sys-color-secondary);
  color: var(--md-sys-color-on-secondary);
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 16px;
}

.editor-section {
  margin-bottom: 16px;
}

.color-input,
.range-input,
.select-input {
  width: 100%;
  margin-top: 4px;
}

.preview-section {
  margin-top: 24px;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.color-item {
  text-align: center;
}

.color-preview {
  width: 100%;
  height: 50px;
  border-radius: 4px;
  margin-bottom: 4px;
}
</style>
