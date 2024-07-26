<template>
  <div class="color-scheme-editor" v-if="currentColorScheme">
    <!-- カラースキーム選択 -->
    <div class="scheme-selector">
      <label for="scheme-select">カラースキーム:</label>
      <select id="scheme-select" :value="currentColorScheme.name" @change="onSchemeChange">
        <option v-for="scheme in availableColorSchemeConfigs" :key="scheme.name" :value="scheme.name">
          {{ scheme.displayName }}
        </option>
      </select>
    </div>

    <!-- ダークモード切り替え -->
    <div class="dark-mode-toggle">
      <label for="dark-mode-switch">ダークモード:</label>
      <input id="dark-mode-switch" type="checkbox" v-model="isDarkMode">
    </div>

    <!-- CoreColorの設定 -->
    <div class="core-color-settings">
      <h3>コアカラー設定</h3>
      <div v-for="key in coreColorKeys" :key="key" class="color-setting-item">
        <label :for="`color-picker-${key}`">{{ key }}:</label>
        <input 
          :id="`color-picker-${key}`"
          type="color" 
          :value="getColorHex(key)"
          @input="updateCoreColor(key, $event.target.value)"
        >
        <span class="color-value">{{ getColorOklch(key) }}</span>
      </div>
    </div>

    <!-- カスタムカラー設定 -->
    <div class="custom-color-settings">
      <h3>カスタムカラー設定</h3>
      <div v-for="color in customColors" :key="color.name" class="custom-color-item">
        <div>
          <label>名前: {{ color.displayName }}</label>
        </div>
        <div>
          <label>ロール: {{ color.role }}</label>
        </div>
        <div>
          <label :for="`custom-color-light-${color.name}`">Light Lightness: {{ color.lightLightness }}</label>
          <input 
            :id="`custom-color-light-${color.name}`" 
            type="range" 
            v-model.number="color.lightLightness" 
            min="0" 
            max="100" 
            step="1"
            @input="updateCustomColor(color)"
          >
        </div>
        <div>
          <label :for="`custom-color-dark-${color.name}`">Dark Lightness: {{ color.darkLightness }}</label>
          <input 
            :id="`custom-color-dark-${color.name}`" 
            type="range" 
            v-model.number="color.darkLightness" 
            min="0" 
            max="100" 
            step="1"
            @input="updateCustomColor(color)"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useColorScheme } from '@/composables/useColorScheme';
import { CoreColorKey, CustomColorConfig } from '@/helpers/colors';
import Color from 'colorjs.io';

const { 
  currentColorScheme, 
  availableColorSchemeConfigs, 
  updateColorScheme, 
  selectColorScheme,
} = useColorScheme();

const isDarkMode = computed({
  get: () => currentColorScheme.value?.config.isDark ?? false,
  set: (value) => {
    updateColorScheme({ isDark: value });
  },
});

const coreColorKeys: CoreColorKey[] = ['primary', 'secondary', 'tertiary', 'neutral', 'neutralVariant', 'error'];

const customColors = ref<CustomColorConfig[]>([]);

watch(() => currentColorScheme.value, (newColorScheme) => {
  if (newColorScheme) {
    customColors.value = newColorScheme.config.customColors?.filter(color => color.role !== undefined) || [];
  }
}, { immediate: true, deep: true });

const onSchemeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  selectColorScheme(target.value);
};

const getColorHex = (key: CoreColorKey): string => {
  const oklch = currentColorScheme.value?.roles[key]?.oklch;
  if (!oklch) return '#000000';
  try {
    const color = new Color(oklch);
    return color.to('srgb').toString({format: 'hex'});
  } catch (error) {
    console.error(`Error converting OKLCH to HEX for ${key}:`, error);
    return '#000000';
  }
};

const getColorOklch = (key: CoreColorKey): string => {
  return currentColorScheme.value?.roles[key]?.oklch || 'oklch(0 0 0)';
};

const updateCoreColor = (key: CoreColorKey, hexValue: string) => {
  try {
    const color = new Color(hexValue);
    const oklch = color.to('oklch');
    const oklchString = `oklch(${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(3)})`;
    updateColorScheme({ [key]: oklchString });
  } catch (error) {
    console.error(`Error updating core color for ${key}:`, error);
  }
};

const updateCustomColor = (color: CustomColorConfig) => {
  const updatedCustomColors = customColors.value.map(c => 
    c.name === color.name ? { ...color } : c
  );
  updateColorScheme({ customColors: updatedCustomColors });
};
</script>

<style scoped>
.color-scheme-editor {
  border-radius: 16px 0 0 16px;
  background: var(--md-sys-color-surface);
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.1);
  padding: 16px;
  max-width: 25%;
  height: calc(100vh - 240px);
  position: fixed;
  right: 0;
  top: 160px;
  overflow-y: auto;
  z-index: 1;
  opacity: 0;

  &:hover {
    opacity: 1;
  }
}

label {
  font-size: 0.875rem;
}

h2,
h3 {
  font-size: 1rem;
  font-weight: 500;
}

.scheme-selector,
.dark-mode-toggle,
.core-color-settings,
.custom-color-settings {
  margin-bottom: 16px;
}

select,
input[type="checkbox"],
input[type="range"],
input[type="color"] {
  margin-left: 0;
  margin-bottom: 8px;
}

.color-setting-item,
.custom-color-item {
  margin-bottom: 16px;
}

.custom-color-item > div {
  margin-bottom: 8px;
}

.color-value {
  margin-left: 8px;
  font-family: monospace;
}

input[type="range"] {
  width: 100%;
}
</style>
