<template>
  <ScrollAreaRoot class="scroll-area" type="auto">
    <ScrollAreaViewport>
      <slot />
    </ScrollAreaViewport>
    <ScrollAreaScrollbar class="scrollbar" orientation="horizontal">
      <ScrollAreaThumb class="thumb-container">
        <div class="thumb"></div>
      </ScrollAreaThumb>
    </ScrollAreaScrollbar>
    <ScrollAreaScrollbar class="scrollbar" orientation="vertical">
      <ScrollAreaThumb class="thumb-container">
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
.scroll-area {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.scrollbar {
  user-select: none;
  touch-action: none;
}

.scrollbar[data-orientation="vertical"] {
  width: vars.$size-scrollbar;
}

.scrollbar[data-orientation="horizontal"] {
  height: vars.$size-scrollbar;
}

.thumb-container {
  padding: 4px;
}

.thumb {
  width: 100%;
  height: 100%;
  background-color: #0002;
  border-radius: vars.$size-scrollbar;
  position: relative;
  transition: background-color vars.$transition-duration;
}

.scrollbar:hover .thumb {
  background-color: #0003;
}
</style>
