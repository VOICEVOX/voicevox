<template>
  <SelectItem class="song-select-item" :value :disabled>
    <SelectItemIndicator class="indicator">
      <SongIcon name="check" size="small" />
    </SelectItemIndicator>
    <SelectItemText>{{ label }}</SelectItemText>
  </SelectItem>
</template>

<script setup lang="ts" generic="T extends AcceptableValue">
import {
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  type AcceptableValue,
} from "reka-ui";
import SongIcon from "./SongIcon.vue";

// のちのち統合する可能性があるため、BaseSelectItemと共通のpropsは揃える
defineProps<{
  value: T;
  label: string;
  disabled?: boolean;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/song-variables" as song-vars;
@use "@/styles/v2/song-mixin" as song-mixin;

.song-select-item {
  position: relative;
  display: flex;
  align-items: center;
  height: song-vars.$size-control-small;
  padding: 0 song-vars.$space-12 0 32px;
  border-radius: song-vars.$radius-8;
  font-size: song-vars.$font-size-body;
  font-variant-numeric: tabular-nums;
  outline: none;
  cursor: pointer;
  user-select: none;

  @include song-mixin.disabled;

  &[data-highlighted] {
    background: var(--scheme-color-song-control-hovered);
  }
}

.indicator {
  position: absolute;
  left: 10px;
  display: flex;
}
</style>
