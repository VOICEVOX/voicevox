<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger asChild>
      <slot name="trigger" :open />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="PopoverContent"
        :align
        :side
        :sideOffset
        :collisionPadding="8"
        avoidCollisions
        hideWhenDetached
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from "reka-ui";

withDefaults(
  defineProps<{
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
  }>(),
  {
    align: "start",
    side: "bottom",
    sideOffset: 4,
  },
);

const open = defineModel<boolean>("open", { default: false });
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

:deep(.PopoverContent) {
  overflow: hidden;
  border: 1px solid colors.$border;
  border-radius: vars.$radius-2;
  color: colors.$display;
  background-color: colors.$background;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: vars.$z-index-dropdown;
}
</style>
