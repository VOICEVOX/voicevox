<template>
  <ScrollAreaRoot class="ScrollAreaRoot" type="auto">
    <ScrollAreaViewport class="ScrollAreaViewport">
      <slot />
    </ScrollAreaViewport>
    <ScrollAreaScrollbar class="ScrollAreaScrollbar" orientation="horizontal">
      <ScrollAreaThumb class="ScrollAreaThumb">
        <div class="thumb"></div>
      </ScrollAreaThumb>
    </ScrollAreaScrollbar>
    <ScrollAreaScrollbar class="ScrollAreaScrollbar" orientation="vertical">
      <ScrollAreaThumb class="ScrollAreaThumb">
        <div class="thumb"></div>
      </ScrollAreaThumb>
    </ScrollAreaScrollbar>
  </ScrollAreaRoot>
</template>

<script setup lang="ts">
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "radix-vue";
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/new-colors' as colors;

.ScrollAreaRoot {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ScrollAreaViewport {
  width: 100%;
  height: 100%;
}

.ScrollAreaScrollbar {
  user-select: none;
  touch-action: none;
}

.ScrollAreaScrollbar[data-orientation="vertical"] {
  width: vars.$size-scrollbar;
}

.ScrollAreaScrollbar[data-orientation="horizontal"] {
  height: vars.$size-scrollbar;
}

.ScrollAreaThumb {
  padding: 4px;
}

.thumb {
  width: 100%;
  height: 100%;
  background-color: colors.$scrollbar;
  border-radius: vars.$size-scrollbar;
  position: relative;
  transition: background-color vars.$transition-duration;
}

.ScrollAreaScrollbar:hover .thumb {
  background-color: colors.$scrollbar-hovered;
}

.ScrollAreaScrollbar:active .thumb {
  background-color: colors.$scrollbar-pressed;
}
</style>
