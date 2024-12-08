<template>
  <BaseTooltip :label>
    <button
      class="button"
      :disabled
      @click="(payload) => $emit('click', payload)"
    >
      <!-- 暫定でq-iconを使用 -->
      <QIcon v-if="icon" :name="icon" size="sm" />
    </button>
  </BaseTooltip>
</template>

<script setup lang="ts">
import BaseTooltip from "./BaseTooltip.vue";

defineProps<{
  icon: string;
  label: string;
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

.button {
  border: none;
  display: flex;
  justify-content: center;
  align-items: center;
  height: vars.$size-control;
  width: vars.$size-control;
  border-radius: vars.$radius-1;
  color: colors.$display;
  background-color: colors.$clear;
  cursor: pointer;

  &:focus-visible {
    @include mixin.on-focus;
  }

  &:hover:not(:disabled) {
    background-color: colors.$clear-hovered;
  }

  &:active:not(:disabled) {
    background-color: colors.$clear-pressed;
  }

  &:disabled {
    // Quasar側のopacity: 0.6 !important;を上書きするためimportantを付与
    opacity: 0.4 !important;
  }
}
</style>
