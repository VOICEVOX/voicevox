<template>
  <button
    class="button"
    :class="variant ? variant : 'default'"
    @click="(payload) => $emit('click', payload)"
  >
    <q-icon v-if="icon" :name="icon" size="sm" />
    {{ label }}
  </button>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  icon?: string;
  variant?: "default" | "primary" | "danger";
}>();

defineEmits<{
  (e: "click", payload: MouseEvent): void;
}>();
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/mixin' as mixin;

.button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: vars.$size-control;
  border-radius: vars.$radius-control;
  padding: 0 vars.$padding-button;
  gap: vars.$gap-control;
  border: 1px solid;
  transition: background-color vars.$transition-duration;
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
  color: #222;
  background-color: #fff;
  border-color: #0002;

  &:hover:not(:disabled) {
    background-color: #f4f5f4;
  }

  &:active:not(:disabled) {
    background-color: #ebeceb;
  }
}

.primary {
  color: #fff;
  border-color: #0002;
  background-color: #a5d4ad;

  &:hover:not(:disabled) {
    background-color: #97cfa1;
  }

  &:active:not(:disabled) {
    background-color: #86c291;
  }
}

.danger {
  color: #d04756;
  border-color: #d04756;
  background-color: #fff;

  &:hover:not(:disabled) {
    background-color: #ffe0e0;
  }

  &:active:not(:disabled) {
    background-color: #ffc1c1;
  }
}
</style>
