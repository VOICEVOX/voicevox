<template>
  <QBadge
    transparent
    color="transparent"
    textColor="display"
    class="full-height cursor-not-allowed no-border-radius title-bar-buttons-root"
  >
    <QBtn
      dense
      flat
      icon="minimize"
      class="title-bar-buttons"
      aria-label="最小化"
      @click="minimizeWindow()"
    ></QBtn>

    <QBtn
      v-if="props.isMaximized || props.isFullscreen"
      dense
      flat
      :icon="mdiWindowRestore"
      class="title-bar-buttons"
      aria-label="最大化"
      @click="toggleMaximizeWindow()"
    >
    </QBtn>

    <QBtn
      v-else
      dense
      flat
      icon="crop_square"
      class="title-bar-buttons"
      aria-label="最大化"
      @click="toggleMaximizeWindow()"
    ></QBtn>

    <QBtn
      dense
      flat
      icon="close"
      class="title-bar-buttons close"
      aria-label="閉じる"
      @click="closeWindow()"
    ></QBtn>
  </QBadge>
</template>

<script setup lang="ts">
import { mdiWindowRestore } from "@quasar/extras/mdi-v5";

const props = defineProps<{
  isMaximized: boolean;
  isFullscreen: boolean;
}>();

const minimizeWindow = () => {
  void window.welcomeBackend.minimizeWindow();
};
const toggleMaximizeWindow = () => {
  void window.welcomeBackend.toggleMaximizeWindow();
};
const closeWindow = () => {
  void window.welcomeBackend.closeWindow();
};
</script>

<style scoped lang="scss">
.q-badge {
  padding: 0;
}

.window-controls-badge {
  margin-left: 12px;
}

.title-bar-buttons-root {
  z-index: 2000;
}

.title-bar-buttons {
  overflow: visible;
}

.close:hover {
  background-color: red;
}
</style>
