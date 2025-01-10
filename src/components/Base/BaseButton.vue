<template>
  <button
    class="button"
    :class="variant ? variant : 'default'"
    :disabled
    @click="(payload) => $emit('click', payload)"
  >
    <!-- 暫定でq-iconを使用 -->
    <QIcon v-if="icon" :name="icon" size="sm" />
    {{ label }}
  </button>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  icon?: string;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
}>();

defineEmits<{
  (e: "click", payload: MouseEvent): void;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

.button {
  display: flex;
  justify-content: center;
  align-items: center;
  text-wrap: nowrap;
  height: vars.$size-control;
  border-radius: vars.$radius-1;
  padding: 0 vars.$padding-2;
  gap: vars.$gap-1;
  border: 1px solid;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

  &:active:not(:disabled) {
    box-shadow: 0 0 0 transparent;
  }

  &:focus-visible {
    @include mixin.on-focus;
  }
}

.default {
  color: colors.$display;
  border-color: colors.$border;
  background-color: colors.$control;

  &:hover:not(:disabled) {
    background-color: colors.$control-hovered;
  }

  &:active:not(:disabled) {
    background-color: colors.$control-pressed;
  }
}

.primary {
  color: colors.$display-oncolor;
  border-color: colors.$border;
  background-color: colors.$primary;

  &:hover:not(:disabled) {
    background-color: colors.$primary-hovered;
  }

  &:active:not(:disabled) {
    background-color: colors.$primary-pressed;
  }
}

.danger {
  color: colors.$display-warning;
  border-color: colors.$display-warning;
  background-color: colors.$warning;

  &:hover:not(:disabled) {
    background-color: colors.$warning-hovered;
  }

  &:active:not(:disabled) {
    background-color: colors.$warning-pressed;
  }
}
</style>
