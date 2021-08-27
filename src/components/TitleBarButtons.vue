<template>
  <q-badge
    v-if="$q.platform.is.mac"
    transparent
    color="transparent"
    text-color="secondary"
    class="full-height cursor-not-allowed no-border-radius"
  >
    <q-btn
      dense
      flat
      round
      icon="push_pin"
      color="black"
      class="title-bar-buttons"
      @click="pinWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      round
      icon="lens"
      color="green"
      class="title-bar-buttons"
      @click="minimizeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      round
      icon="lens"
      color="yellow"
      class="title-bar-buttons"
      @click="maximizeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      icon="lens"
      color="red"
      class="title-bar-buttons"
      @click="closeWindow()"
    ></q-btn>
  </q-badge>
  <q-badge
    v-else
    transparent
    color="transparent"
    text-color="secondary"
    class="
      full-height
      cursor-not-allowed
      no-border-radius
      title-bar-buttons-root
    "
  >
    <q-btn
      v-if="isPinned"
      dense
      flat
      round
      icon="push_pin"
      color="teal"
      class="title-bar-buttons"
      id="pinned-btn"
      @click="pinWindow()"
    ></q-btn>
    <q-btn
      v-else
      dense
      flat
      round
      icon="push_pin"
      color="black"
      class="title-bar-buttons rotate-45"
      id="pinned-btn"
      @click="pinWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      icon="minimize"
      class="title-bar-buttons"
      @click="minimizeWindow()"
    ></q-btn>

    <q-btn
      v-if="!isMaximized"
      dense
      flat
      icon="crop_square"
      class="title-bar-buttons"
      @click="maximizeWindow()"
    ></q-btn>
    <q-btn
      v-else
      dense
      flat
      :icon="mdiWindowRestore"
      class="title-bar-buttons"
      @click="maximizeWindow()"
    >
    </q-btn>

    <q-btn
      dense
      flat
      icon="close"
      class="title-bar-buttons close"
      @click="closeWindow()"
    ></q-btn>
  </q-badge>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import Mousetrap from "mousetrap";
import { mdiWindowRestore } from "@quasar/extras/mdi-v5";

export default defineComponent({
  name: "TitleBarButtons",
  setup() {
    const closeWindow = () => window.electron.closeWindow();
    const minimizeWindow = () => window.electron.minimizeWindow();
    const maximizeWindow = () => {
      window.electron.maximizeWindow();
    };

    const isPinned = computed(() => store.state.isPinned);

    const pinWindow = () => {
      window.electron.pinWindow();
    };

    const store = useStore();

    const isMaximized = computed(() => store.state.isMaximized);

    Mousetrap.bind(["alt+f4", "command+q"], closeWindow);

    return {
      closeWindow,
      minimizeWindow,
      maximizeWindow,
      pinWindow,
      mdiWindowRestore,
      isMaximized,
      isPinned,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;

.q-badge {
  padding: 0;
}

.title-bar-buttons-root {
  z-index: 2000;
}

.title-bar-buttons {
  -webkit-app-region: no-drag;
  overflow: visible;
}

.close:hover {
  background-color: red;
}
</style>
