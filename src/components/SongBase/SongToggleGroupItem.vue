<template>
  <ToggleGroupItem :value class="song-toggle-group-item">
    {{ label }}
  </ToggleGroupItem>
</template>

<script setup lang="ts" generic="T extends AcceptableValue">
import { type AcceptableValue, ToggleGroupItem } from "reka-ui";

// のちのち統合する可能性があるため、BaseToggleGroupItemと共通のpropsは揃える
defineProps<{
  label: string;
  value: T;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/song-variables" as song-vars;
@use "@/styles/v2/song-mixin" as song-mixin;

.song-toggle-group-item {
  height: 100%;
  padding: 0 song-vars.$space-12;
  border: none;
  border-radius: song-vars.$radius-full;
  background-color: transparent;
  color: var(--scheme-color-song-on-surface-sub);
  font: inherit;
  font-size: song-vars.$font-size-control;
  white-space: nowrap;
  cursor: pointer;
  @include song-mixin.state-layer;
  @include song-mixin.focus-ring;
  @include song-mixin.disabled;

  &[aria-pressed="true"] {
    background-color: var(--scheme-color-surface-container-highest);
    box-shadow: 0 1px 2px oklch(from var(--scheme-color-shadow) l c h / 10%);
    color: var(--scheme-color-on-surface);
    @include song-mixin.font-medium;
  }
}
</style>
