<template>
  <button
    class="row-card"
    :class="{ clickable: clickable }"
    @click="(payload) => $emit('click', payload)"
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
  clickable: boolean;
}>();

defineEmits<{
  (e: "click", payload: MouseEvent): void;
}>();
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/mixin' as mixin;
@use '@/styles/new-colors' as colors;

.row-card {
  display: flex;
  text-align: unset;
  align-items: center;
  border: 1px solid colors.$border;
  background-color: colors.$surface;
  color: colors.$display;
  border-radius: vars.$radius-2;
  padding: vars.$padding-2;
  gap: vars.$gap-2;
  transition: background-color vars.$transition-duration;
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
}

.text {
  flex-grow: 1;
}

.description {
  font-size: 0.75rem;
}
</style>
