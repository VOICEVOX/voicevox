<template>
  <div
    class="color-scheme-editor"
    :class="{ 'is-closed': !isColorSchemeEditorOpen }"
    @click="openColorSchemeEditor"
  >
    <section class="section combo-section">
      <SelectRoot v-model="selectedScheme" @update:modelValue="onSchemeChange">
        <SelectTrigger class="select-trigger" aria-label="カラースキームを選択">
          <SelectValue placeholder="カラースキームを選択" />
        </SelectTrigger>
        <SelectPortal>
          <SelectContent
            class="select-content"
            position="popper"
            :options="schemeOptions"
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
      <button
        class="button-link"
        style="margin-left: 0.25rem"
        @click="closeColorSchemeEditor"
      >
        エディタをたたむ
      </button>
    </section>

    <!-- ベースロールカラーとカスタムカラーの表示と変更 -->
    <section class="section">
      <div class="color-grid">
        <div v-for="roleName in baseRoles" :key="roleName" class="color-item">
          <input
            type="color"
            :value="getRoleColorHex(roleName)"
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
            :value="cssStringToHex(customColor.sourceColor)"
            :title="customColor.name"
            @input="
              (e) =>
                updateCustomColor(
                  customColor.name,
                  (e.target as HTMLInputElement).value,
                )
            "
          />
          <span>{{ customColor.name }}</span>
        </div>
      </div>
      <div class="add-custom-color-button-wrapper">
        <button class="add-custom-color-button" @click="addCustomColor">
          カスタムカラーを追加
        </button>
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
                      v-for="role in allRoles"
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
            v-for="shade in sortedPaletteShades"
            :key="shade"
            class="palette-color"
            :style="{
              backgroundColor: oklchToCssString(palette.shades[shade]),
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
    <!-- コントラストチェックセクション -->
    <section class="section">
      <div class="section-header">コントラストチェック</div>
      <div class="contrast-results">
        <div
          v-for="result in contrastResults"
          :key="`${result.pair[0]}-${result.pair[1]}`"
          class="contrast-item"
        >
          <div class="contrast-colors">
            <div
              class="color-box"
              :style="{
                backgroundColor: oklchToCssString(
                  currentColorScheme.roles[result.pair[0]][
                    isDarkMode ? 'darkShade' : 'lightShade'
                  ],
                ),
              }"
            ></div>
            <div
              class="color-box"
              :style="{
                backgroundColor: oklchToCssString(
                  currentColorScheme.roles[result.pair[1]][
                    isDarkMode ? 'darkShade' : 'lightShade'
                  ],
                ),
              }"
            ></div>
          </div>
          <div class="contrast-info">
            <span>{{ result.pair[0] }} : {{ result.pair[1] }}</span>
            <span>{{ result.description }}</span>
            <span :class="['contrast-level', result.level.toLowerCase()]">
              {{ result.contrast.toFixed(2) }}/{{ result.requiredContrast }} ({{
                result.level
              }})
            </span>
          </div>
        </div>
      </div>
    </section>
    <!-- ダウンロードボタン -->
    <section class="section">
      <button style="margin-right: 0.5rem" @click="downloadColorSchemeConfig">
        JSON
      </button>
      <button @click="downloadCSSVariables">CSS</button>
    </section>
  </div>
</template>

<script setup lang="ts">
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
  SliderRoot,
  SliderTrack,
  SliderRange,
  SliderThumb,
  SwitchRoot,
  SwitchThumb,
} from "radix-vue";
import { useColorScheme } from "@/composables/useColorScheme";
import {
  ColorRole,
  OklchColor,
  ColorSchemeConfig,
  CustomColorConfig,
} from "@/sing/colorScheme/types";
import {
  cssStringToOklch,
  hexToCssString,
  cssStringToHex,
  oklchToCssString,
} from "@/sing/colorScheme/util";
import {
  DEFINED_ROLES,
  DEFINED_CONTRAST_PAIR,
} from "@/sing/colorScheme/constants";
import { cssVariablesFromColorScheme } from "@/sing/colorScheme/css";
import {
  getContrastRatio,
  getContrastLevel,
} from "@/sing/colorScheme/accessibility";

const {
  currentColorScheme,
  availableColorSchemeConfigs,
  isDarkMode,
  updateColorScheme,
  selectColorScheme,
  setColorSchemeFromConfig,
} = useColorScheme();

// state
// 選択中のカラースキーム
const selectedScheme = ref(currentColorScheme.value.name);
// 初期カラースキーム設定
const initialSchemeConfig = ref<ColorSchemeConfig | null>(null);
// 開閉状態
const isColorSchemeEditorOpen = ref(true);

// computed
// カラースキーム一覧
const schemeOptions = computed(() => {
  return availableColorSchemeConfigs.value.map((config) => ({
    label: config.displayName,
    value: config.name,
  }));
});

// 基本的なロール名 eg: primary, neutralVariant, error
const baseRoles = computed<ColorRole[]>(() => [...DEFINED_ROLES]);

// 追加されたロールも含めたすべてのロール名
const allRoles = computed<string[]>(() => [
  ...baseRoles.value,
  ...(currentColorScheme.value.config.customColors?.map((cc) => cc.name) || []),
]);

const customColors = computed(
  () => currentColorScheme.value.config.customColors || [],
);
// const aliasColors = computed(() => currentColorScheme.value.config.aliasColors || []);

// パレットのシェードを明度順にソートしたもの
const sortedPaletteShades = computed(() => {
  return Object.keys(
    currentColorScheme.value.palettes[
      Object.keys(currentColorScheme.value.palettes)[0]
    ].shades,
  )
    .map(Number)
    .sort((a, b) => a - b);
});

// すべてのパレット: デフォルトのパレット + カスタムカラーのパレット
const allPalettes = computed(() => {
  const basePalettes = currentColorScheme.value.palettes;
  const customPalettes = customColors.value.reduce(
    (acc, customColor) => {
      acc[customColor.name] = generateCustomPalette(customColor);
      return acc;
    },
    {} as Record<string, { name: string; shades: Record<number, OklchColor> }>,
  );

  return { ...basePalettes, ...customPalettes };
});

// コントラストチェック結果
const contrastResults = computed(() => {
  return DEFINED_CONTRAST_PAIR.map((pair) => {
    const shadeType = isDarkMode.value ? "darkShade" : "lightShade";
    const color1 = currentColorScheme.value.roles[pair.colors[0]][shadeType];
    const cssColor1 = oklchToCssString(color1);
    const color2 = currentColorScheme.value.roles[pair.colors[1]][shadeType];
    const cssColor2 = oklchToCssString(color2);
    const contrast = Math.abs(getContrastRatio(cssColor1, cssColor2));
    return {
      pair: pair.colors,
      contrast,
      level: getContrastLevel(contrast, pair.requiredContrast),
      requiredContrast: pair.requiredContrast,
      description: pair.description,
    };
  });
});

/*
const customColorHex = computed(() => (customColor: CustomColorConfig) => 
  cssStringToHex(customColor.sourceColor)
); */

// メソッド

/**
 * カラースキームを選択する
 * @param schemeName : string - カラースキーム名
 */
const onSchemeChange = async () => {
  selectColorScheme(selectedScheme.value);
  initialSchemeConfig.value = JSON.parse(
    JSON.stringify(currentColorScheme.value.config),
  );
};

/**
 * 現在のカラースキームをデフォルトに戻す
 */
const resetCurrentScheme = async () => {
  if (initialSchemeConfig.value) {
    // impl: 確認を表示する
    const confirmed = true;
    if (confirmed) {
      setColorSchemeFromConfig(initialSchemeConfig.value);
    }
  }
};

/**
 * ロールのカラーをUIに表示するためのHEX文字列を取得する
 * @param role : ColorRole - ロール名
 * @returns string - ロールのカラー
 */
const getRoleColorHex = (role: ColorRole): string => {
  const roleColor = currentColorScheme.value.config.roleColors[role];
  if (roleColor) {
    return cssStringToHex(roleColor);
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

  return oklchToCssString(color, "hex");
};

/**
 * ロールのカラーを更新する
 * @param role : ColorRole - ロール名
 * @param hexColor : string - ロールのカラー
 */
const updateRoleColor = (role: ColorRole, hexColor: string) => {
  const newRoleColors = {
    ...currentColorScheme.value.config.roleColors,
    [role]: hexToCssString(hexColor),
  };
  updateColorScheme({ roleColors: newRoleColors });
};

/**
 * カスタムカラーを更新する
 * @param name : string - カスタムカラー名
 * @param hexColor : string - カスタムカラー
 */
const updateCustomColor = (name: string, hexColor: string) => {
  const updatedCustomColors =
    currentColorScheme.value.config.customColors?.map((cc) =>
      cc.name === name ? { ...cc, sourceColor: hexToCssString(hexColor) } : cc,
    ) ?? [];
  updateColorScheme({ customColors: updatedCustomColors });
};

/**
 * カスタムカラーを追加する
 */
const addCustomColor = async () => {
  // impl: 入力可能にする
  const newColorName = "Custom";
  if (newColorName) {
    const newCustomColor: CustomColorConfig = {
      name: newColorName,
      displayName: newColorName,
      sourceColor: "#000000",
      asRole: false,
    };
    const updatedCustomColors = [
      ...(currentColorScheme.value.config.customColors ?? []),
      newCustomColor,
    ];
    updateColorScheme({ customColors: updatedCustomColors });
  }
};

/**
 * エイリアスカラーのロールを更新する
 * @param name : string - エイリアスカラー名
 * @param value : ColorRole - ロール名
 */
const updateAliasColorRole = (name: string, value: ColorRole) => {
  const aliasColors = currentColorScheme.value.config.aliasColors ?? [];
  const updatedAliasColors = aliasColors.map((ac) =>
    ac.name === name ? { ...ac, role: value } : ac,
  );
  updateColorScheme({ aliasColors: updatedAliasColors });
};

/**
 * エイリアスカラーの明度を更新する(スライダー用)
 * @param name : string - エイリアスカラー名
 * @param shade : number - 0-1
 */
const updateAliasColorShade = (name: string, shade: number) => {
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
  updateColorScheme({ aliasColors: updatedAliasColors });
};

/**
 * カラースキームの設定をJSONファイルとしてダウンロードする
 */
const downloadColorSchemeConfig = () => {
  const config = currentColorScheme.value.config;
  const jsonContent = JSON.stringify(config, null, 2);
  downloadFile(
    jsonContent,
    `${config.name}_color_scheme_config.json`,
    "application/json",
  );
};

/**
 * カラースキームのCSS変数をCSSファイルとしてダウンロードする
 */
const downloadCSSVariables = () => {
  const cssVars = cssVariablesFromColorScheme(
    currentColorScheme.value,
    true,
    true,
    "hex",
  );

  // cssVars.palettes が存在する場合にのみアクセス
  const cssContent = `:root {\n${Object.entries(cssVars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n")}\n}`;

  downloadFile(
    cssContent,
    `${currentColorScheme.value.name}_color_scheme_variables.css`,
    "text/css",
  );
};

/**
 * ファイルをダウンロードする
 * @param content : string - ファイルの内容
 * @param fileName : string - ファイル名
 * @param contentType : string - ファイルのMIMEタイプ
 */
const downloadFile = (
  content: string,
  fileName: string,
  contentType: string,
) => {
  const blob = new Blob([content], { type: contentType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};

/**
 * カスタムカラーのパレットを生成する
 * @param customColor : CustomColorConfig - カスタムカラー
 * @returns { name: string, shades: Record<number, OklchColor> } - カスタムカラーのパレット
 */
const generateCustomPalette = (customColor: CustomColorConfig) => {
  const baseColor = cssStringToOklch(customColor.sourceColor);
  const shades = sortedPaletteShades.value.reduce(
    (acc, shade) => {
      acc[shade] = adjustShade(baseColor, shade);
      return acc;
    },
    {} as Record<number, OklchColor>,
  );

  return { name: customColor.name, shades };
};

/**
 * シェードを調整する
 * @param sourceColor : OklchColor - ソースカラー
 * @param shade : number - 0-1
 * @returns OklchColor - 調整されたシェード
 */
const adjustShade = (sourceColor: OklchColor, shade: number): OklchColor => {
  const [, c, h] = sourceColor;
  const newL = shade;
  const newC = Number(c);
  const newH = Number(h);
  return [newL, newC, newH];
};

// エディタを開く
const openColorSchemeEditor = () => {
  if (isColorSchemeEditorOpen.value === true) {
    return;
  }
  isColorSchemeEditorOpen.value = true;
};

// エディタを閉じる
const closeColorSchemeEditor = (event: Event) => {
  event.stopPropagation();
  isColorSchemeEditorOpen.value = false;
};

// マウント時に初期カラースキーム設定を保存する(オブジェクトのシャローコピーの影響があるためJSON.parse(JSON.stringify())を使用)
onMounted(() => {
  initialSchemeConfig.value = JSON.parse(
    JSON.stringify(currentColorScheme.value.config),
  );
});
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
  transition: transform 0.16s ease-out;
}

.color-scheme-editor.is-closed {
  transform: translate3d(calc(100% - 48px), 0, 0);
  opacity: 0.8;
  cursor: pointer;
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

.add-custom-color-button-wrapper {
  display: flex;
  justify-content: end;
  margin-top: 1rem;
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
  padding: 0.5rem 1rem;
  background-color: var(--scheme-color-secondary);
  color: var(--scheme-color-on-secondary);
  border: none;
  border-radius: 1.5rem;
  cursor: pointer;
  line-height: 1;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.1s ease-out;

  &:hover {
    opacity: 0.8;
  }
}

.add-custom-color-button {
  background: transparent;
  color: var(--scheme-color-link); /* primitive-blueのリンクカラーを試す */
}

.button-link {
  background: transparent;
  padding: 0;
  color: var(--scheme-color-link);
}

.contrast-results {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.contrast-item {
  background-color: oklch(from var(--scheme-color-surface-variant) l c h / 0.8);
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.contrast-colors {
  display: flex;
  gap: 0.5rem;
}

.color-box {
  width: 2rem;
  height: 2rem;
  border-radius: 0.25rem;
}

.contrast-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.contrast-level {
  font-weight: bold;
}

.contrast-level.pass {
  color: var(--scheme-color-primary);
}

.contrast-level.warn {
  color: var(--scheme-color-error);
}

.contrast-level.fail {
  color: var(--scheme-color-error);
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
  padding: 0.5rem 0.5rem;
  font-size: 0.875rem;
  line-height: 1;
  background-color: var(--scheme-color-surface);
  color: var(--scheme-color-on-surface);
  border: 1px solid var(--scheme-color-outline-variant);
  border-radius: 0.25rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.1s ease-out;
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
  font-weight: 500;
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
