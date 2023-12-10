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
@use '@/styles/colors' as colors;
@use '@/styles/mixin' as mixin;

.row-card {
  display: flex;
  text-align: unset;
  align-items: center;
  border: 1px solid #0002;
  background-color: #fff;
  border-radius: vars.$radius-container;
  padding: vars.$padding-container;
  gap: vars.$gap-container;
  transition: background-color vars.$transition-duration;
}

.clickable:not(:disabled) {
  cursor: pointer;

  &:hover {
    background-color: #f4f5f4;
  }

  &:active {
    background-color: #ebeceb;
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
