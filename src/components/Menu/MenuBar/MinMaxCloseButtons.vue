<template>
  <QBadge
    v-if="$q.platform.is.mac"
    transparent
    color="transparent"
    textColor="display"
    class="full-height cursor-not-allowed no-border-radius"
  >
    <QBtn
      dense
      flat
      round
      icon="lens"
      size="8.5px"
      color="red"
      class="title-bar-buttons"
      aria-label="閉じる"
      @click="closeWindow()"
    ></QBtn>
    <QBtn
      dense
      flat
      round
      icon="lens"
      size="8.5px"
      color="yellow"
      class="title-bar-buttons"
      aria-label="最小化"
      @click="minimizeWindow()"
    ></QBtn>
    <QBtn
      dense
      flat
      round
      icon="lens"
      size="8.5px"
      color="green"
      class="title-bar-buttons"
      aria-label="最大化"
      @click="maximizeWindow()"
    ></QBtn>
  </QBadge>
  <QBadge
    v-else
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
      v-if="!isMaximized"
      dense
      flat
      icon="crop_square"
      class="title-bar-buttons"
      aria-label="最大化"
      @click="maximizeWindow()"
    ></QBtn>
    <QBtn
      v-else
      dense
      flat
      :icon="mdiWindowRestore"
      class="title-bar-buttons"
      aria-label="最大化"
      @click="maximizeWindow()"
    >
    </QBtn>

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
  store.dispatch("CHECK_EDITED_AND_NOT_SAVE", { closeOrReload: "close" });
};
const minimizeWindow = () => window.backend.minimizeWindow();
const maximizeWindow = () => window.backend.maximizeWindow();

const isMaximized = computed(() => store.state.isMaximized);
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
