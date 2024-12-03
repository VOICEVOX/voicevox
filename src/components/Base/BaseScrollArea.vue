<template>
  <ScrollAreaRoot class="ScrollAreaRoot" type="auto">
    <ScrollAreaViewport asChild>
      <div class="ScrollAreaViewport">
        <slot />
      </div>
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
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

.ScrollAreaRoot {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// 親要素のサイズいっぱいに広げさせるためプライベートなデータ属性を使用
:deep([data-radix-scroll-area-viewport]) {
  width: 100%;
  height: 100%;
}

:deep(.ScrollAreaViewport) {
  height: 100%;
}

.ScrollAreaScrollbar {
  user-select: none;
  touch-action: none;
  z-index: vars.$z-index-scrollbar;
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
}

.ScrollAreaScrollbar:hover .thumb {
  background-color: colors.$scrollbar-hovered;
}

.ScrollAreaScrollbar:active .thumb {
  background-color: colors.$scrollbar-pressed;
}
</style>
