<template>
  <ContextMenuRoot v-model:open="open">
    <ContextMenuTrigger asChild>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="ContextMenuContent"
        :collisionPadding="8"
        avoidCollisions
        hideWhenDetached
      >
        <slot name="menu" />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
} from "reka-ui";

const open = defineModel<boolean>("open", { default: false });
</script>

<style lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

.ContextMenuContent {
  min-width: 240px;
  background-color: colors.$background;
  border-radius: vars.$radius-2;
  overflow: hidden;
  padding: vars.$padding-1;
  border: 1px solid colors.$border;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  z-index: vars.$z-index-dropdown;
}
</style>
