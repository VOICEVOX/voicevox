<template>
  <button
    class="row-card"
    :class="{ clickable: clickable }"
    role="listitem"
    :disabled
    :tabindex="clickable ? 0 : -1"
    @click="(payload) => !disabled && $emit('click', payload)"
  >
    <div class="text">
      <div class="title">{{ title }}</div>
      <div class="description">{{ description }}</div>
    </div>
    <div class="control">
      <slot />
    </div>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  clickable?: boolean;
  disabled?: boolean;
}>();

defineEmits<{
  (e: "click", payload: MouseEvent): void;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

.row-card {
  display: flex;
  flex-wrap: wrap;
  text-align: unset;
  align-items: center;
  border: 1px solid colors.$border;
  background-color: colors.$surface;
  color: colors.$display;
  border-radius: vars.$radius-2;
  padding: vars.$padding-2;
  gap: vars.$gap-2;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.clickable:not(:disabled) {
  cursor: pointer;

  &:hover {
    background-color: colors.$control-hovered;
  }

  &:active {
    background-color: colors.$control-pressed;
  }

  &:focus-visible {
    @include mixin.on-focus;
  }

  &:disabled {
    opacity: 0.5;
  }
}

.text {
  flex: 1;
  min-width: 240px;
}

.title {
  // FIXME: medium (500)にする
  font-weight: 700;
}

.description {
  // TODO: html要素のfont-size指定が16pxになり次第remでの指定に変更する
  // font-size: 0.75rem;
  font-size: 12px;
}

.control {
  display: flex;
  flex-wrap: wrap;
  justify-content: right;
  align-items: center;
  gap: vars.$gap-1;
  margin-left: auto;
}
</style>
