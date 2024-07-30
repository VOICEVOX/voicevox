<template>
  <div v-if="isReady" class="color-scheme-editor">
    <h2>カラースキーマエディタ</h2>
    
    <!-- スキーマセレクター -->
    <div class="scheme-selector">
      <label for="scheme-select">スキーマ選択：</label>
      <select id="scheme-select" v-model="selectedScheme" @change="onSchemeChange">
        <option v-for="scheme in availableColorSchemeConfigs" :key="scheme.name" :value="scheme.name">
          {{ scheme.displayName }}
        </option>
      </select>
    </div>

    <!-- ベースカラーエディタ -->
    <div class="base-color-editor">
      <h3>ベースカラー</h3>
      <div v-for="role in baseRoles" :key="role" class="color-item">
        <label :for="role">{{ roleDisplayNames[role] || role }}</label>
        <input
          :id="role"
          type="color"
          :value="colorsForRoles[role]"
          @input="updateBaseColor(role, $event.target ? $event.target.value : '')"
        />
        <span>{{ colorsForRoles[role] }}</span>
      </div>
    </div>

    <!-- カスタムカラーエディタ -->
    <div class="custom-color-editor">
      <h3>カスタムカラー</h3>
      <div v-for="color in editableScheme.config.customColors" :key="color.name" class="color-item">
        <label :for="color.name">{{ color.displayName }}</label>
        <input
          :id="color.name"
          type="color"
          :value="toHexString(color.color)"
          @input="updateCustomColor(color.name, $event.target.value)"
        />
        <span>{{ toHexString(color.color) }}</span>
        <button @click="removeCustomColor(color.name)">削除</button>
      </div>
      <div class="add-custom-color">
        <input v-model="newCustomColorName" placeholder="新規カラー名" />
        <input v-model="newCustomColorValue" type="color" />
        <button @click="addCustomColor" :disabled="!newCustomColorName">追加</button>
      </div>
    </div>

    <!-- エイリアスカラーエディタ -->
    <div class="alias-color-editor">
      <h3>エイリアスカラー</h3>
      <div v-for="alias in editableScheme.config.aliasColors" :key="alias.name" class="alias-item">
        <label>{{ alias.displayName }}</label>
        <select v-model="alias.role" @change="updateAliasColorRole(alias)">
          <option v-for="role in availableRoles" :key="role" :value="role">
            {{ roleDisplayNames[role] || role }}
          </option>
        </select>
        <div class="alias-sliders">
          <div>
            <label>Light: {{ alias.lightShade.toFixed(2) }}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              v-model.number="alias.lightShade"
              @input="updateAliasColor(alias)"
            />
          </div>
          <div>
            <label>Dark: {{ alias.darkShade.toFixed(2) }}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              v-model.number="alias.darkShade"
              @input="updateAliasColor(alias)"
            />
          </div>
        </div>
        <button @click="removeAliasColor(alias.name)">削除</button>
      </div>
      <div class="add-alias-color">
        <input v-model="newAliasName" placeholder="新規エイリアス名" />
        <select v-model="newAliasRole">
          <option v-for="role in availableRoles" :key="role" :value="role">
            {{ roleDisplayNames[role] || role }}
          </option>
        </select>
        <button @click="addAliasColor" :disabled="!newAliasName || !newAliasRole">追加</button>
      </div>
    </div>

    <!-- パレットビューワー -->
    <div v-if="editableScheme.palettes" class="palette-viewer">
      <h3>カラーパレット</h3>
      <div v-for="(palette, role) in editableScheme.palettes" :key="role" class="palette-row">
        <div class="role-name">{{ roleDisplayNames[role] || role }}</div>
        <div class="shade-cells">
          <div
            v-for="(color, shade) in palette.shades"
            :key="shade"
            class="shade-cell"
            :style="{ backgroundColor: toHexString(toCssString(color)) }"
          >
            {{ shade }}
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="loading">Loading color scheme...</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useStore } from '@/store'
import { useColorScheme } from '@/composables/useColorScheme'
import { toCssString, fromCssString } from '@/sing/colorScheme/generator'
import {
  ColorSchemeConfig,
  OklchColor,
  CustomColorConfig,
  AliasColorConfig,
  ColorRole,
  ColorScheme,
} from '@/sing/colorScheme/types'
import Color from 'colorjs.io'

const store = useStore()
const {
  currentColorScheme,
  availableColorSchemeConfigs,
  updateColorScheme,
  selectColorScheme,
  getColorFromRole,
} = useColorScheme()

const selectedScheme = ref<string>("")
const newCustomColorName = ref("")
const newCustomColorValue = ref("#000000")
const newAliasName = ref("")
const newAliasRole = ref<ColorRole>("primary")
const isReady = ref(false)

// editableScheme の初期値を設定
const editableScheme = ref<ColorSchemeConfig>({
  name: "",
  displayName: "",
  baseColors: {},
  customColors: [],
  aliasColors: [],
})

const baseRoles = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
  "error",
] as const

// OKLCH形式からHEX形式に変換する関数
const toHexString = (colorString: string): string => {
  try {
    const color = new Color(colorString)
    return color.to("srgb").toString({ format: "hex" })
  } catch (error) {
    console.error("Error converting color to HEX:", error)
    return "#000000"
  }
}

// 修正された getColorForRole 関数
const getColorForRole = (role: string): string => {
  // editableScheme が undefined でないことを確認
  if (!editableScheme.value) {
    console.warn('editableScheme is not initialized')
    return "#808080" // デフォルト色
  }

  // baseColors をチェック
  if (editableScheme.value.baseColors && role in editableScheme.value.baseColors) {
    return toHexString(editableScheme.value.baseColors[role])
  }

  // customColors をチェック
  const customColor = editableScheme.value.customColors?.find(c => c.name === role)
  if (customColor) {
    return toHexString(customColor.color)
  }

  // currentColorScheme から色を取得
  if (currentColorScheme.value && currentColorScheme.value.roles) {
    const colorSet = currentColorScheme.value.roles[role]
    if (colorSet) {
      const isDarkMode = computed(() => store.state.themeSetting.currentTheme === 'Dark')
      const oklchColor = isDarkMode.value ? colorSet.dark : colorSet.light
      if (oklchColor) {
        return toHexString(toCssString(oklchColor))
      }
    }
  }

  console.warn(`No color found for role: ${role}`)
  return "#808080" // デフォルト色
}

// データ初期化関数
const initializeData = async () => {
  if (currentColorScheme.value && currentColorScheme.value.config) {
    editableScheme.value = JSON.parse(JSON.stringify(currentColorScheme.value.config))
    selectedScheme.value = currentColorScheme.value.name
    isReady.value = true
  } else {
    console.warn('Current color scheme is not available')
  }
}

// コンポーネントのマウント時にデータを初期化
onMounted(async () => {
  await initializeData()
})

// currentColorScheme の変更を監視
watch(
  () => currentColorScheme.value,
  async (newScheme) => {
    if (newScheme) {
      await initializeData()
    }
  },
  { immediate: true, deep: true }
)

const applyChanges = (newConfig: ColorSchemeConfig) => {
  if (currentColorScheme.value) {
    const updatedScheme = { ...currentColorScheme.value, config: newConfig }
    store.dispatch("SET_COLOR_SCHEME", { colorScheme: updatedScheme })
  } else {
    console.error('Cannot apply changes: currentColorScheme is not available')
  }
}

const onSchemeChange = () => {
  if (selectedScheme.value) {
    selectColorScheme(selectedScheme.value);
  }
};

const updateBaseColor = (role: string, color: string) => {
  const newConfig = { ...editableScheme.value.config };
  newConfig.baseColors = { ...newConfig.baseColors, [role]: color };
  applyChanges(newConfig);
};

const updateCustomColor = (name: string, color: string) => {
  const newConfig = { ...editableScheme.value.config };
  newConfig.customColors = newConfig.customColors?.map((c) =>
    c.name === name ? { ...c, color } : c
  ) ?? [];
  applyChanges(newConfig);
};

const removeCustomColor = (name: string) => {
  const newConfig = { ...editableScheme.value.config };
  newConfig.customColors = newConfig.customColors?.filter((c) => c.name !== name) ?? [];
  applyChanges(newConfig);
};

const addCustomColor = () => {
  if (newCustomColorName.value && newCustomColorValue.value) {
    const newColor: CustomColorConfig = {
      name: newCustomColorName.value,
      displayName: newCustomColorName.value,
      color: newCustomColorValue.value,
    };
    const newConfig = { ...editableScheme.value.config };
    newConfig.customColors = [...(newConfig.customColors ?? []), newColor];
    applyChanges(newConfig);
    newCustomColorName.value = "";
    newCustomColorValue.value = "#000000";
  }
};

const updateAliasColor = (alias: AliasColorConfig) => {
  const newConfig = { ...editableScheme.value.config };
  newConfig.aliasColors = newConfig.aliasColors?.map((a) =>
    a.name === alias.name ? { ...alias } : a
  ) ?? [];
  applyChanges(newConfig);
};

const updateAliasColorRole = (alias: AliasColorConfig) => {
  const baseColor = getColorFromRole(alias.role, "array") as OklchColor;
  const lightColor = new Color("oklch", [
    baseColor[0] + (1 - baseColor[0]) * alias.lightShade,
    baseColor[1],
    baseColor[2],
  ]);
  const darkColor = new Color("oklch", [
    baseColor[0] * alias.darkShade,
    baseColor[1],
    baseColor[2],
  ]);
  
  const newAlias = {
    ...alias,
    lightShade: lightColor.oklch[0],
    darkShade: darkColor.oklch[0],
  };
  
  const newConfig = { ...editableScheme.value.config };
  newConfig.aliasColors = newConfig.aliasColors?.map((a) =>
    a.name === alias.name ? newAlias : a
  ) ?? [];
  applyChanges(newConfig);
};

const removeAliasColor = (name: string) => {
  const newConfig = { ...editableScheme.value.config };
  newConfig.aliasColors = newConfig.aliasColors?.filter((a) => a.name !== name) ?? [];
  applyChanges(newConfig);
};

const addAliasColor = () => {
  if (newAliasName.value && newAliasRole.value) {
    const baseColor = getColorFromRole(newAliasRole.value, "array") as OklchColor;
    const newAlias: AliasColorConfig = {
      name: newAliasName.value,
      displayName: newAliasName.value,
      role: newAliasRole.value,
      lightShade: Math.min(baseColor[0] + 0.1, 1),
      darkShade: Math.max(baseColor[0] - 0.1, 0),
    };
    const newConfig = { ...editableScheme.value.config };
    newConfig.aliasColors = [...(newConfig.aliasColors ?? []), newAlias];
    applyChanges(newConfig);
    newAliasName.value = "";
    newAliasRole.value = "primary";
  }
};

// Vuexストアの変更を監視し、editableSchemeを更新
watch(() => store.state.colorSchemeSetting.currentColorScheme, (newScheme) => {
  if (newScheme) {
    editableScheme.value = generateColorSchemeFromConfig(newScheme.config);
  }
}, { deep: true });

</script>

<style scoped>
.color-scheme-editor {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  position: fixed;
  height: 100vh;
  z-index: 1;
  top: 0;
  right: 0;
  background-color: var(--scheme-color-surface);
  overflow-y: auto;
}

.color-item, .alias-item {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
}

.color-item label, .alias-item label {
  width: 150px;
  margin-right: 10px;
}

.palette-row {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.role-name {
  width: 150px;
}

.shade-cells {
  display: flex;
  flex-wrap: wrap;
}

.shade-cell {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border: 1px solid #ccc;
}

.alias-sliders {
  display: flex;
  gap: 20px;
}

.add-custom-color {
  margin-top: 10px;
}

.add-custom-color input {
  margin-right: 10px;
}

.loading {
  text-align: center;
  padding: 20px;
  font-size: 18px;
}
</style>
