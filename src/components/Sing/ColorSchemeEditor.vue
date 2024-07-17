<template>
  <div v-if="isShowEditor" class="scheme-editor">
    <div class="editor-content">
      <h2 class="editor-title">
        <QIcon name="mdi:arrow-left" @click="isShowEditor = false" />
        カラースキーム
      </h2>
      <div class="editor-section">
        <label>テーマ</label>
        <select
          :value="
            availableColorSchemes.find(
              (scheme) => scheme.label === colorSchemeConfig.label,
            )
          "
          class="select-input"
          @change="updateColorScheme"
        >
          <option
            v-for="scheme in availableColorSchemes"
            :key="scheme"
            :value="scheme"
          >
            {{ scheme.label }}
          </option>
        </select>
      </div>
      <div class="editor-section">
        <button @click="resetColorScheme">リセット</button>
      </div>
      <div class="editor-section">
        <label>ソースカラー</label>
        <input
          :value="colorSchemeConfig.sourceColor"
          class="color-input"
          type="color"
          @input="updateSourceColor"
        />
      </div>

      <div class="editor-section">
        <input
          type="checkbox"
          :checked="colorSchemeConfig.isDark"
          @change="updateIsDark"
        />
        ダークテーマ
      </div>

      <div class="editor-section">
        <label>バリエーション</label>
        <select
          :value="colorSchemeConfig.variant"
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
          コントラスト {{ colorSchemeConfig.contrastLevel.toFixed(2) }}
          <input
            :value="colorSchemeConfig.contrastLevel"
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
              v-if="getAdjustment(color, 'hex')"
              :value="getAdjustment(color, 'hex')"
              type="color"
              class="color-input"
              @input="(e) => updateAdjustment(color, 'hex', e.target.value)"
            />
            <button v-else @click="addHexToAdjustment(color)">Hexを追加</button>
          </label>
        </div>
        <div v-for="prop in ['hue', 'chroma', 'tone']" :key="prop">
          <label>
            {{ prop.charAt(0).toUpperCase() + prop.slice(1) }}:
            {{ getAdjustment(color, prop).toFixed(2) }}
            <input
              :value="getAdjustment(color, prop)"
              type="range"
              :min="prop === 'hue' ? 0 : prop === 'chroma' ? 0 : 0"
              :max="prop === 'hue' ? 360 : prop === 'chroma' ? 150 : 100"
              :step="prop === 'chroma' ? 0.1 : 1"
              class="range-input"
              @input="
                (e) => updateAdjustment(color, prop, Number(e.target.value))
              "
            />
          </label>
        </div>
      </div>

      <hr />

      <h3 class="custom-palette-title">カスタムカラー</h3>
      <div
        v-for="(color, index) in colorSchemeConfig.customPaletteColors"
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
              step="1"
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
              step="1"
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
import { computed, ref } from "vue";
import { Hct } from "@material/material-color-utilities";
import { useStore } from "@/store";
import { ColorSchemeConfig, SchemeVariant, PaletteKey } from "@/type/preload";

const store = useStore();

const isShowEditor = ref(true);

const availableColorSchemes = computed<ColorSchemeConfig[]>(() => {
  return store.state.colorSchemeSetting.availableColorSchemes;
});

const colorSchemeConfig = computed<ColorSchemeConfig>(() => {
  // deep copy
  return JSON.parse(
    JSON.stringify(
      store.state.colorSchemeSetting.colorScheme.colorSchemeConfig,
    ),
  );
});

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

const getAdjustment = (color: string, property: string) => {
  return colorSchemeConfig.value.adjustments?.[color]?.[property] ?? 0;
};

const updateColorScheme = () => {
  store.dispatch("SET_COLOR_SCHEME_SETTING", {
    colorSchemeConfig: colorSchemeConfig.value,
  });
};

const updateSourceColor = (e: Event) => {
  colorSchemeConfig.value.sourceColor = (e.target as HTMLInputElement).value;
  updateColorScheme();
};

const updateVariant = (e: Event) => {
  colorSchemeConfig.value.variant = (e.target as HTMLSelectElement)
    .value as SchemeVariant;
  updateColorScheme();
};

const updateContrastLevel = (e: Event) => {
  colorSchemeConfig.value.contrastLevel = Number(
    (e.target as HTMLInputElement).value,
  );
  updateColorScheme();
};

const updateAdjustment = (
  color: string,
  property: string,
  value: number | string,
) => {
  if (!colorSchemeConfig.value.adjustments) {
    colorSchemeConfig.value.adjustments = {};
  }
  if (!colorSchemeConfig.value.adjustments[color]) {
    colorSchemeConfig.value.adjustments[color] = {};
  }
  colorSchemeConfig.value.adjustments[color][property] = value;
  updateColorScheme();
};

const addHexToAdjustment = (color: string) => {
  const hue = getAdjustment(color, "hue");
  const chroma = getAdjustment(color, "chroma");
  const tone = getAdjustment(color, "tone");
  const hct = Hct.from(hue, chroma, tone);
  const hex = `#${hct.toInt().toString(16).padStart(6, "0")}`;
  updateAdjustment(color, "hex", hex);
};

const updateCustomPaletteColor = (
  index: number,
  property: string,
  value: string | number | boolean,
) => {
  if (colorSchemeConfig.value.customPaletteColors) {
    colorSchemeConfig.value.customPaletteColors[index][property] = value;
    updateColorScheme();
  }
};

const resetColorScheme = () => {
  store.dispatch("INITIALIZE_COLOR_SCHEME");
};

const updateIsDark = (e: Event) => {
  colorSchemeConfig.value.isDark = (e.target as HTMLInputElement).checked;
  updateColorScheme();
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
