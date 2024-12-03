<template>
  <SelectItem class="SelectItem" :value :disabled>
    <SelectItemText>{{ label }}</SelectItemText>
    <SelectItemIndicator class="SelectItemIndicator" />
  </SelectItem>
</template>

<script setup lang="ts">
import { SelectItem, SelectItemText, SelectItemIndicator } from "radix-vue";

defineProps<{
  value: string;
  label: string;
  disabled?: boolean;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

.SelectItem {
  color: colors.$display;
  cursor: pointer;
  position: relative;
  min-height: vars.$size-control;
  display: flex;
  align-items: center;
  background-color: colors.$clear;
  border: none;
  padding: vars.$padding-1 vars.$padding-2;
  border-radius: vars.$radius-1;

  &:not([data-state="checked"]):hover {
    background-color: colors.$clear-hovered;
  }

  &:not([data-state="checked"]):active {
    background-color: colors.$clear-pressed;
  }

  &:focus-visible {
    @include mixin.on-focus;
    outline-offset: -2px;
  }

  &[data-highlighted] {
    background-color: colors.$clear-hovered;
  }

  &[data-state="checked"] {
    background-color: colors.$selected;
  }

  &[data-disabled] {
    opacity: 0.5;
    pointer-events: none;
  }
}

.SelectItemIndicator {
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

[data-state="checked"] > .SelectItemIndicator {
  opacity: 1;
  height: 16px;
}
</style>
