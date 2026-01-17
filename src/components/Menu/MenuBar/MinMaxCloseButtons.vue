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
      v-if="isMaximized || isFullscreen"
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
import { computed } from "vue";
import { mdiWindowRestore } from "@quasar/extras/mdi-v5";
import { useStore } from "@/store";

const store = useStore();

const closeWindow = async () => {
  void store.actions.CHECK_EDITED_AND_NOT_SAVE({ closeOrReload: "close" });
};
const minimizeWindow = () => window.backend.minimizeWindow();
const toggleMaximizeWindow = () => window.backend.toggleMaximizeWindow();

const isMaximized = computed(() => store.state.isMaximized);
const isFullscreen = computed(() => store.getters.IS_FULLSCREEN);
</script>

<style scoped lang="scss">
.q-badge {
  padding: 0;
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
