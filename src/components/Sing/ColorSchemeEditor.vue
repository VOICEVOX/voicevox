<template>
  <div class="scheme-editor">
    <div class="editor-content">
      <h2 class="editor-title">カラースキーム</h2>

      <div class="editor-section">
        <label>ソースカラー</label>
        <input
          :value="colorScheme.sourceColor"
          type="color"
          class="color-input"
          @input="updateSourceColor"
        />
      </div>

      <div class="editor-section">
        <label>バリエーション</label>
        <select
          :value="colorScheme.variant"
          class="select-input"
          @change="updateVariant"
        >
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
          コントラスト {{ colorScheme.contrastLevel.toFixed(2) }}
          <input
            :value="colorScheme.contrastLevel"
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
        <div
          v-for="(value, property) in colorScheme.adjustments[color]"
          :key="property"
        >
          <label>
            {{ property }}: {{ value }}
            <input
              v-if="property === 'hex'"
              :value
              type="color"
              class="color-input"
              @input="(e) => updateAdjustment(color, property, e.target.value)"
            />
            <input
              v-else
              :value
              type="range"
              :min="0"
              :max="property === 'hue' ? 360 : 100"
              :step="property === 'chroma' ? 0.1 : 1"
              class="range-input"
              @input="
                (e) => updateAdjustment(color, property, Number(e.target.value))
              "
            />
          </label>
        </div>
      </div>
      <hr />
      <h3 class="custom-palette-title">カスタムカラー</h3>
      <div
        v-for="(color, index) in colorScheme.customPaletteColors"
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
              (e) => updateCustomPaletteColor(index, 'palette', e.target.value)
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
              class="range-input"
              @input="
                (e) =>
                  updateCustomPaletteColor(
                    index,
                    'lightTone',
                    Number(e.target.value),
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
              class="range-input"
              @input="
                (e) =>
                  updateCustomPaletteColor(
                    index,
                    'darkTone',
                    Number(e.target.value),
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
                  updateCustomPaletteColor(index, 'blend', e.target.checked)
              "
            />
            ブレンド
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import { ColorSchemeConfig, SchemeVariant, PaletteKey } from "@/type/preload";

const store = useStore();

const colorScheme = computed(() => store.state.colorSchemeSetting.colorScheme);

const colorKeys = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
];
const variantOptions: SchemeVariant[] = [
  "tonalSpot",
  "neutral",
  "vibrant",
  "expressive",
  "content",
  "fidelity",
  "monochrome",
  "rainbow",
  "fruitSalad",
];
const paletteOptions: PaletteKey[] = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
];

const updateSourceColor = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  updateColorScheme({ sourceColor: value });
};

const updateVariant = (e: Event) => {
  const value = (e.target as HTMLSelectElement).value as SchemeVariant;
  updateColorScheme({ variant: value });
};

const updateContrastLevel = (e: Event) => {
  const value = Number((e.target as HTMLInputElement).value);
  updateColorScheme({ contrastLevel: value });
};

const updateAdjustment = (
  color: string,
  property: string,
  value: number | string,
) => {
  const newAdjustments = {
    ...colorScheme.value.adjustments,
    [color]: {
      ...colorScheme.value.adjustments[color],
      [property]: value,
    },
  };
  updateColorScheme({ adjustments: newAdjustments });
};

const updateCustomPaletteColor = (
  index: number,
  property: string,
  value: any,
) => {
  const newCustomPaletteColors = [...colorScheme.value.customPaletteColors];
  newCustomPaletteColors[index] = {
    ...newCustomPaletteColors[index],
    [property]: value,
  };
  updateColorScheme({ customPaletteColors: newCustomPaletteColors });
};

const updateColorScheme = (newValues: Partial<ColorSchemeConfig>) => {
  store.dispatch("SET_COLOR_SCHEME_SETTING", {
    colorScheme: { ...colorScheme.value, ...newValues },
  });
};
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
  right: 16px;
  top: 144px;
  z-index: 10000;
  padding: 8px 16px;
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  border-radius: 20px;
  cursor: pointer;
  opacity: 0.1;
  transition: all 0.4s ease;

  &:hover {
    opacity: 1;
  }
}

.scheme-editor {
  position: fixed;
  bottom: 48px;
  right: 0;
  width: 300px;
  height: 80vh;
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  border-radius: 16px 0 0 16px;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease;
  overflow-y: auto;
  z-index: 9999;
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
