<template>
  <ScrollAreaRoot class="ScrollAreaRoot" type="auto">
    <ScrollAreaViewport asChild>
      <div class="ScrollAreaViewport">
        <slot />
      </div>
    </ScrollAreaViewport>
    <ScrollAreaScrollbar class="ScrollAreaScrollbar" orientation="horizontal">
      <ScrollAreaThumb class="ScrollAreaThumb"></ScrollAreaThumb>
    </ScrollAreaScrollbar>
    <ScrollAreaScrollbar class="ScrollAreaScrollbar" orientation="vertical">
      <ScrollAreaThumb class="ScrollAreaThumb"></ScrollAreaThumb>
    </ScrollAreaScrollbar>
  </ScrollAreaRoot>
</template>

<script setup lang="ts">
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "reka-ui";
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

.ScrollAreaRoot {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: grid;
}

.ScrollAreaViewport {
  height: 100%;
  width: 100%;
}

.ScrollAreaScrollbar {
  display: flex;
  user-select: none;
  touch-action: none;
  z-index: vars.$z-index-scrollbar;
  padding: 4px;
}

.ScrollAreaScrollbar[data-orientation="vertical"] {
  width: vars.$size-scrollbar;
}

.ScrollAreaScrollbar[data-orientation="horizontal"] {
  flex-direction: column;
  height: vars.$size-scrollbar;
}

.ScrollAreaThumb {
  flex: 1;
  background-color: colors.$scrollbar;
  border-radius: vars.$size-scrollbar;
  position: relative;
}

.ScrollAreaScrollbar:hover .ScrollAreaThumb {
  background-color: colors.$scrollbar-hovered;
}

.ScrollAreaScrollbar:active .ScrollAreaThumb {
  background-color: colors.$scrollbar-pressed;
}
</style>
