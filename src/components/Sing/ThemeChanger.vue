<template>
  <div
    class="space-y-4 p-4"
    style="
      border-radius: 16px;
      position: fixed;
      right: 16px;
      bottom: 48px;
      z-index: 9999;
      overflow: auto;
      max-height: 100vh;
      height: 600px;
      width: 300px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.8);
    "
  >
    <div>
      <label class="block mb-2">Source Color:</label>
      <input v-model="sourceColor" type="color" class="w-full h-10" />
    </div>

    <div>
      <label class="block mb-2">Dark Mode:</label>
      <input v-model="isDark" type="checkbox" />
    </div>

    <div>
      <label class="block mb-2">
        Contrast Level: {{ contrastLevel.toFixed(2) }}
      </label>
      <input
        v-model.number="contrastLevel"
        type="range"
        min="-1"
        max="1"
        step="0.1"
        class="w-full"
      />
    </div>

    <div>
      <label class="block mb-2">Variant:</label>
      <select v-model="variant" class="w-full p-2 border rounded">
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
      class="space-y-2 border-t pt-4"
    >
      <p>
        {{ color.charAt(0).toUpperCase() + color.slice(1) }}
      </p>
      <div>
        <label class="block mb-1">Hue: {{ colorSettings[color].hue }}</label>
        <input
          v-model.number="colorSettings[color].hue"
          type="range"
          min="0"
          max="360"
          class="w-full"
        />
      </div>
      <div>
        <label class="block mb-1"
          >Chroma: {{ colorSettings[color].chroma }}</label
        >
        <input
          v-model.number="colorSettings[color].chroma"
          type="range"
          min="0"
          max="150"
          class="w-full"
        />
      </div>
      <div>
        <label class="block mb-1">Tone: {{ colorSettings[color].tone }}</label>
        <input
          v-model.number="colorSettings[color].tone"
          type="range"
          min="0"
          max="100"
          class="w-full"
        />
      </div>
    </div>

    <div class="border-t pt-4">
      <h3 class="text-lg font-semibold mb-2">Custom Palette Colors</h3>
      <div
        v-for="(color, index) in customPaletteColors"
        :key="index"
        class="space-y-2 mb-4"
      >
        <div>
          <label class="block mb-1">{{ color.name }}</label>
          <select v-model="color.palette" class="w-full p-2 border rounded">
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="tertiary">Tertiary</option>
            <option value="neutral">Neutral</option>
            <option value="neutralVariant">Neutral Variant</option>
          </select>
        </div>
        <div>
          <label class="block mb-1">Light Tone: {{ color.lightTone }}</label>
          <input
            v-model.number="color.lightTone"
            type="range"
            min="0"
            max="100"
            class="w-full"
          />
        </div>
        <div>
          <label class="block mb-1">Dark Tone: {{ color.darkTone }}</label>
          <input
            v-model.number="color.darkTone"
            type="range"
            min="0"
            max="100"
            class="w-full"
          />
        </div>
        <div>
          <label class="block mb-1">
            <input v-model="color.blend" type="checkbox" />
            Blend
          </label>
        </div>
      </div>
    </div>

    <div class="mt-8">
      <h3 class="text-xl font-bold mb-4">Preview</h3>
      <div class="grid grid-cols-3 gap-4">
        <div
          v-for="role in [
            'primary',
            'secondary',
            'tertiary',
            'error',
            'neutral',
            'neutralVariant',
          ]"
          :key="role"
          class="space-y-2"
        >
          <div
            class="w-full h-20 rounded"
            :style="{ backgroundColor: `var(--md-sys-color-${role})` }"
          ></div>
          <p class="text-center">{{ role }}</p>
        </div>
      </div>
    </div>

    <div class="mt-8">
      <h3 class="text-xl font-bold mb-4">Custom Palette Colors Preview</h3>
      <div class="grid grid-cols-3 gap-4">
        <div
          v-for="color in customPaletteColors"
          :key="color.name"
          class="space-y-2"
        >
          <div
            class="w-full h-20 rounded"
            :style="{ backgroundColor: `var(--${color.name})` }"
          ></div>
          <p class="text-center">{{ color.name }}</p>
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

    const customPaletteColors = reactive([
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
    ]);

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
      sourceColor,
      isDark,
      contrastLevel,
      variant,
      colorSettings,
      customPaletteColors,
    };
  },
};
</script>