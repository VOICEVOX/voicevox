<template>
  <button
    class="listitem"
    :class="selected && 'selected'"
    role="listitem"
    @click="(payload) => $emit('click', payload)"
  >
    <div class="indicator"></div>
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  selected?: boolean;
}>();

defineEmits<{
  (e: "click", payload: MouseEvent): void;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

.listitem {
  color: colors.$display;
  cursor: pointer;
  position: relative;
  min-height: vars.$size-listitem;
  display: flex;
  align-items: center;
  background-color: colors.$clear;
  border: none;
  padding: vars.$padding-1 vars.$padding-2;
  border-radius: vars.$radius-1;
  text-align: left;

  &:not(.selected):hover {
    background-color: colors.$clear-hovered;
  }

  &:not(.selected):active {
    background-color: colors.$clear-pressed;
  }

  &:focus-visible {
    @include mixin.on-focus;
  }
}

.indicator {
  position: absolute;
  left: 6px;
  height: 0;
  width: 4px;
  border-radius: 2px;
  background-color: colors.$primary;
  opacity: 0;
  transition-duration: vars.$transition-duration;
  transition-property: height opacity;
}

.selected {
  background-color: colors.$selected;

  .indicator {
    opacity: 1;
    height: 16px;
  }
}
</style>
