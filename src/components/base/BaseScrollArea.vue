<template>
  <ScrollAreaRoot class="ScrollAreaRoot" type="auto">
    <ScrollAreaViewport class="ScrollAreaViewport">
      <slot />
    </ScrollAreaViewport>
    <ScrollAreaScrollbar class="ScrollAreaScrollbar" orientation="horizontal">
      <ScrollAreaThumb class="ScrollAreaThumbContainer">
        <div class="ScrollAreaThumb"></div>
      </ScrollAreaThumb>
    </ScrollAreaScrollbar>
    <ScrollAreaScrollbar class="ScrollAreaScrollbar" orientation="vertical">
      <ScrollAreaThumb class="ScrollAreaThumbContainer">
        <div class="ScrollAreaThumb"></div>
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

.ScrollAreaThumbContainer {
  padding: 4px;
}

.ScrollAreaThumb {
  width: 100%;
  height: 100%;
  background-color: #0002;
  border-radius: vars.$size-scrollbar;
  position: relative;
  transition: background-color vars.$transition-duration;
}

.ScrollAreaScrollbar:hover .ScrollAreaThumb {
  background-color: #0003;
}
</style>
