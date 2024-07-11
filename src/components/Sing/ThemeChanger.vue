<template>
  <!-- 仮調整用 -->
  <div>
    <button
      class="toggle-button"
      :class="{ 'editor-open': isEditorOpen }"
      @click="toggleEditor"
    >
      {{ isEditorOpen ? "閉じる" : "テーマエディタ" }}
    </button>
    <div
      v-show="isEditorOpen"
      class="scheme-editor"
      :class="{ 'editor-open': isEditorOpen }"
    >
      <div class="editor-content">
        <h2 class="editor-title">カラースキームエディタ</h2>
        <button class="reset-button" @click="resetToDefaults">
          デフォルトに戻す
        </button>

        <div class="editor-section">
          <label>Source Color:</label>
          <input v-model="sourceColor" type="color" class="color-input" />
        </div>

        <div class="editor-section">
          <label>
            <input v-model="isDark" type="checkbox" />
            Dark Mode
          </label>
        </div>

        <div class="editor-section">
          <label>
            Contrast Level: {{ contrastLevel.toFixed(2) }}
            <input
              v-model.number="contrastLevel"
              type="range"
              min="-1"
              max="1"
              step="0.1"
              class="range-input"
            />
          </label>
        </div>

        <div class="editor-section">
          <label>Variant:</label>
          <select v-model="variant" class="select-input">
            <option value="tonalSpot">Tonal Spot</option>
            <option value="fidelity">Fidelity</option>
            <option value="vibrant">Vibrant</option>
            <option value="expressive">Expressive</option>
            <option value="content">Content</option>
            <option value="neutral">Neutral</option>
            <option value="monochrome">Monochrome</option>
            <option value="rainbow">Rainbow</option>
            <option value="fruitSalad">Fruit Salad</option>
          </select>
        </div>

        <div
          v-for="color in [
            'primary',
            'secondary',
            'tertiary',
            'neutral',
            'neutralVariant',
          ]"
          :key="color"
          class="editor-section"
        >
          <h3>{{ color.charAt(0).toUpperCase() + color.slice(1) }}</h3>
          <div>
            <label>
              Hue: {{ colorSettings[color].hue }}
              <input
                v-model.number="colorSettings[color].hue"
                type="range"
                min="0"
                max="360"
                class="range-input"
                step="1"
              />
            </label>
          </div>
          <div>
            <label>
              Chroma: {{ colorSettings[color].chroma }}
              <input
                v-model.number="colorSettings[color].chroma"
                type="range"
                min="0"
                max="100"
                class="range-input"
                step="0.1"
              />
            </label>
          </div>
          <div>
            <label>
              Tone: {{ colorSettings[color].tone }}
              <input
                v-model.number="colorSettings[color].tone"
                type="range"
                min="0"
                max="100"
                class="range-input"
                step="1"
              />
            </label>
          </div>
        </div>

        <h3 class="custom-palette-title">Custom Palette Colors</h3>
        <div
          v-for="(color, index) in customPaletteColors"
          :key="index"
          class="editor-section custom-palette-color"
        >
          <h4>{{ color.name }}</h4>
          <div>
            <label>Palette:</label>
            <select v-model="color.palette" class="select-input">
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="tertiary">Tertiary</option>
              <option value="neutral">Neutral</option>
              <option value="neutralVariant">Neutral Variant</option>
            </select>
          </div>
          <div>
            <label>
              Light Tone: {{ color.lightTone }}
              <input
                v-model.number="color.lightTone"
                type="range"
                min="0"
                max="100"
                class="range-input"
              />
            </label>
          </div>
          <div>
            <label>
              Dark Tone: {{ color.darkTone }}
              <input
                v-model.number="color.darkTone"
                type="range"
                min="0"
                max="100"
                class="range-input"
              />
            </label>
          </div>
          <div>
            <label>
              <input v-model="color.blend" type="checkbox" />
              Blend
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, watch } from "vue";
import { Hct, argbFromHex } from "@material/material-color-utilities";
import {
  createDynamicScheme,
  dynamicSchemeToCssVariables,
} from "@/helpers/colors";

export default {
  name: "SchemeEditor",
  setup() {
    const isEditorOpen = ref(false);
    const sourceColor = ref("#A5D4AD");
    const isDark = ref(false);
    const contrastLevel = ref(0);
    const variant = ref("tonalSpot");
    const colorSettings = reactive({
      primary: { hue: null, chroma: null, tone: 40 },
      secondary: { hue: null, chroma: null, tone: 90 },
      tertiary: { hue: null, chroma: null, tone: 90 },
      neutral: { hue: null, chroma: 0, tone: 90 },
      neutralVariant: { hue: null, chroma: 6, tone: 90 },
    });

    const defaultSettings = {
      sourceColor: "#A5D4AD",
      isDark: false,
      contrastLevel: 0,
      variant: "tonalSpot",
      colorSettings: {
        primary: { hue: null, chroma: null, tone: 40 },
        secondary: { hue: null, chroma: null, tone: 90 },
        tertiary: { hue: null, chroma: null, tone: 90 },
        neutral: { hue: null, chroma: 0, tone: 90 },
        neutralVariant: { hue: null, chroma: 6, tone: 90 },
      },
      customPaletteColors: [
        {
          name: "sing-grid-cell-white",
          palette: "neutral",
          lightTone: 100,
          darkTone: 15,
          blend: true,
        },
        {
          name: "sing-grid-cell-black",
          palette: "neutral",
          lightTone: 98,
          darkTone: 12,
          blend: true,
        },
        {
          name: "sing-ruler-beat-line",
          palette: "neutralVariant",
          lightTone: 70,
          darkTone: 40,
          blend: true,
        },
        {
          name: "sing-ruler-measure-line",
          palette: "neutralVariant",
          lightTone: 50,
          darkTone: 50,
          blend: true,
        },
        {
          name: "sing-grid-vertical-line",
          palette: "neutral",
          lightTone: 95,
          darkTone: 10,
          blend: true,
        },
        {
          name: "sing-grid-horizontal-line",
          palette: "neutral",
          lightTone: 95,
          darkTone: 10,
          blend: true,
        },
        {
          name: "sing-grid-beat-line",
          palette: "neutral",
          lightTone: 90,
          darkTone: 0,
          blend: true,
        },
        {
          name: "sing-grid-measure-line",
          palette: "neutral",
          lightTone: 80,
          darkTone: 40,
          blend: true,
        },
        {
          name: "sing-grid-octave-line",
          palette: "neutral",
          lightTone: 80,
          darkTone: 40,
          blend: true,
        },
        {
          name: "sing-piano-key-white",
          palette: "neutral",
          lightTone: 99,
          darkTone: 70,
          blend: true,
        },
        {
          name: "sing-piano-key-black",
          palette: "neutral",
          lightTone: 40,
          darkTone: 20,
          blend: true,
        },
        {
          name: "sing-note-bar-background",
          palette: "secondary",
          lightTone: 90,
          darkTone: 70,
          blend: true,
        },
        {
          name: "sing-toolbar-background",
          palette: "neutral",
          lightTone: 99,
          darkTone: 10,
          blend: true,
        },
      ],
    };

    const customPaletteColors = reactive([
      ...defaultSettings.customPaletteColors,
    ]);

    const toggleEditor = () => {
      isEditorOpen.value = !isEditorOpen.value;
    };

    const resetToDefaults = () => {
      sourceColor.value = defaultSettings.sourceColor;
      isDark.value = defaultSettings.isDark;
      contrastLevel.value = defaultSettings.contrastLevel;
      variant.value = defaultSettings.variant;
      Object.assign(colorSettings, defaultSettings.colorSettings);
      customPaletteColors.splice(
        0,
        customPaletteColors.length,
        ...defaultSettings.customPaletteColors,
      );
    };

    const updateScheme = () => {
      const sourceColorHct = Hct.fromInt(argbFromHex(sourceColor.value));

      const themeAdjustments = {};
      for (const [key, value] of Object.entries(colorSettings)) {
        themeAdjustments[key] = {
          hue:
            value.hue != null
              ? value.hue
              : key === "tertiary"
                ? (sourceColorHct.hue + 60) % 360
                : sourceColorHct.hue,
          chroma:
            value.chroma != null
              ? value.chroma
              : key === "neutral"
                ? 0
                : key === "neutralVariant"
                  ? 6
                  : undefined,
          tone: value.tone,
        };
      }

      const baseScheme = createDynamicScheme({
        sourceColor: sourceColor.value,
        variant: variant.value,
        isDark: isDark.value,
        contrastLevel: contrastLevel.value,
        adjustments: themeAdjustments,
      });

      const cssVariables = dynamicSchemeToCssVariables(
        baseScheme,
        customPaletteColors,
        [],
      );

      Object.entries(cssVariables).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    };

    watch(
      [
        sourceColor,
        isDark,
        contrastLevel,
        variant,
        colorSettings,
        customPaletteColors,
      ],
      updateScheme,
      { deep: true, immediate: true },
    );

    return {
      isEditorOpen,
      sourceColor,
      isDark,
      contrastLevel,
      variant,
      colorSettings,
      customPaletteColors,
      toggleEditor,
      resetToDefaults,
    };
  },
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
  right: -300px;
  bottom: 48px;
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
