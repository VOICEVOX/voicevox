<template>
  <span class="song-icon" :class="[size, { filled }]" aria-hidden="true">{{
    name
  }}</span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string;
    size?: "default" | "small";
    filled?: boolean;
  }>(),
  {
    size: "default",
    filled: false,
  },
);
</script>

<style scoped lang="scss">
@use "@/styles/v2/song-variables" as song-vars;

.song-icon {
  display: inline-block;
  font-family: "Material Symbols Rounded";
  font-size: song-vars.$size-icon;
  font-style: normal;
  font-weight: normal;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  direction: ltr;
  user-select: none;

  &.small {
    font-size: song-vars.$size-icon-small;
  }

  &.filled {
    font-family: "Material Symbols Rounded Filled";
  }
}
</style>
