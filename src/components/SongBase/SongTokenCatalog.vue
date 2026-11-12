<template>
  <div ref="root" class="song-token-catalog">
    <section v-if="section === 'colors'">
      <div v-for="name in colorNames" :key="name" class="row">
        <span class="preview">
          <span class="swatch" :style="{ background: `var(--${name})` }" />
        </span>
        <code class="name">{{ name }}</code>
      </div>
    </section>

    <section v-else-if="section === 'sizes'">
      <div v-for="name in sizeNames" :key="name" class="row">
        <span class="preview">
          <span
            class="size-box"
            :data-token="name"
            :style="{ width: v(name), height: v(name) }"
          />
        </span>
        <code class="name">${{ name }}</code>
        <code class="value">{{ values[name] }}</code>
      </div>
    </section>

    <section v-else-if="section === 'spaces'">
      <div v-for="name in spaceNames" :key="name" class="row">
        <span class="preview">
          <span
            class="space-bar"
            :data-token="name"
            :style="{ width: v(name) }"
          />
        </span>
        <code class="name">${{ name }}</code>
        <code class="value">{{ values[name] }}</code>
      </div>
    </section>

    <section v-else-if="section === 'radii'">
      <div v-for="name in radiusNames" :key="name" class="row">
        <span class="preview">
          <span
            class="radius-box"
            :data-token="name"
            :style="{ borderRadius: v(name) }"
          />
        </span>
        <code class="name">${{ name }}</code>
        <code class="value">{{ values[name] }}</code>
      </div>
    </section>

    <section v-else-if="section === 'typography'">
      <div v-for="name in fontSizeNames" :key="name" class="row">
        <span class="sample" :data-token="name" :style="{ fontSize: v(name) }">
          ドレミ 1/16 135
        </span>
        <code class="name">${{ name }}</code>
        <code class="value">{{ values[name] }}</code>
      </div>
      <div class="row">
        <span class="sample medium">ドレミ 1/16 135</span>
        <code class="name">@include song-mixin.font-medium</code>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from "vue";

// Storybookでトークンを一覧するための部品。アプリでは使わない
defineProps<{
  section: "colors" | "sizes" | "spaces" | "radii" | "typography";
}>();

const colorNames = [
  "scheme-color-on-surface",
  "scheme-color-song-on-surface-sub",
  "scheme-color-song-control-hovered",
  "scheme-color-song-control-pressed",
  "scheme-color-song-control-selected",
  "scheme-color-song-control-checked",
  "scheme-color-primary",
  "scheme-color-song-divider",
  "scheme-color-song-border",
  "scheme-color-surface-container-highest",
];
const sizeNames = [
  "size-control",
  "size-control-small",
  "size-icon",
  "size-icon-small",
];
const spaceNames = [
  "space-2",
  "space-4",
  "space-6",
  "space-8",
  "space-12",
  "space-16",
  "space-24",
];
const radiusNames = ["radius-6", "radius-8", "radius-12", "radius-full"];
const fontSizeNames = [
  "font-size-caption",
  "font-size-body",
  "font-size-control",
  "font-size-value",
];

// SCSS変数はスタイルの中でCSS変数に写してから参照する
const v = (name: string) => `var(--song-vars-${name})`;

const root = useTemplateRef<HTMLElement>("root");
const values = ref<Record<string, string>>({});
onMounted(() => {
  if (root.value == null) {
    throw new Error("root is not mounted");
  }
  // 基準値から計算する値もあるので、描いた見本の寸法を読んで実際の値を示す
  const measure = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    if (element.classList.contains("radius-box")) {
      return style.borderTopLeftRadius;
    }
    if (element.classList.contains("sample")) {
      return style.fontSize;
    }
    return style.width;
  };
  values.value = Object.fromEntries(
    [...root.value.querySelectorAll<HTMLElement>("[data-token]")].map(
      (element) => [element.dataset.token, measure(element)],
    ),
  );
});
</script>

<style scoped lang="scss">
@use "sass:meta";
@use "@/styles/v2/song-variables" as song-vars;
@use "@/styles/v2/song-mixin" as song-mixin;

.song-token-catalog {
  @each $name, $value in meta.module-variables("song-vars") {
    --song-vars-#{$name}: #{$value};
  }

  padding: song-vars.$space-24;
  // 部品が実際に置かれる面の上で見比べる
  background: var(--scheme-color-song-toolbar-container);
  color: var(--scheme-color-on-surface);
}

section {
  display: flex;
  flex-direction: column;
  gap: song-vars.$space-16;
}

.row {
  display: flex;
  align-items: center;
  gap: song-vars.$space-16;
}

// 見本の大きさが違っても名前の位置がそろうよう、見本の列の幅を固定する
.preview {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
}

.name {
  min-width: 360px;
  font-size: song-vars.$font-size-body;
}

.value {
  color: var(--scheme-color-song-on-surface-sub);
  font-size: song-vars.$font-size-body;
}

.swatch {
  width: 48px;
  height: 48px;
  border: 1px solid var(--scheme-color-song-divider);
  border-radius: song-vars.$radius-6;
}

.size-box,
.radius-box {
  background: var(--scheme-color-song-control-selected);
}

.radius-box {
  width: 48px;
  height: 48px;
}

.space-bar {
  height: song-vars.$space-8;
  background: var(--scheme-color-song-on-surface-sub);
}

.sample {
  min-width: 160px;
}

.medium {
  font-size: song-vars.$font-size-value;
  @include song-mixin.font-medium;
}
</style>
