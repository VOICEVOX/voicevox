<template>
  <ContextMenuItem
    :disabled
    class="ContextMenuItem"
    @select="$emit('select', $event)"
  >
    {{ label }}
    <div class="shortcut">{{ shortcut }}</div>
  </ContextMenuItem>
</template>

<script setup lang="ts">
import { ContextMenuItem } from "reka-ui";

defineProps<{
  label: string;
  shortcut?: string;
  disabled?: boolean;
}>();

defineEmits<{
  select: [event: Event];
}>();
</script>

<style lang="scss" scoped>
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.ContextMenuItem {
  position: relative;
  display: flex;
  align-items: center;
  height: vars.$size-control;
  padding: 0 vars.$padding-1;
  padding-left: vars.$padding-2;
  border-radius: vars.$radius-1;
  color: colors.$display;
  cursor: pointer;

  &[data-disabled] {
    opacity: 0.5;
    pointer-events: none;
  }

  &[data-highlighted] {
    background-color: colors.$clear-hovered;
  }

  &:focus-visible {
    @include mixin.on-focus;
  }
}

.shortcut {
  margin-left: auto;
  color: colors.$display-sub;
}
</style>
