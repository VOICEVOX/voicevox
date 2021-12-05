<template>
  <q-badge
    v-if="$q.platform.is.mac"
    color="bg-primary"
    text-color="display"
    class="full-height cursor-not-allowed no-border-radius"
  >
    <q-btn
      dense
      flat
      round
      icon="lens"
      size="8.5px"
      color="red"
      class="title-bar-buttons"
      @click="closeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      round
      icon="lens"
      size="8.5px"
      color="yellow"
      class="title-bar-buttons"
      @click="minimizeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      round
      icon="lens"
      size="8.5px"
      color="green"
      class="title-bar-buttons"
      @click="maximizeWindow()"
    ></q-btn>
  </q-badge>
  <q-badge
    v-else
    transparent
    color="transparent"
    text-color="display"
    class="
      full-height
      cursor-not-allowed
      no-border-radius
      title-bar-buttons-root
    "
  >
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
import { mdiWindowRestore } from "@quasar/extras/mdi-v5";

export default defineComponent({
  name: "MinMaxCloseButtons",
  setup() {
    const store = useStore();

    const closeWindow = async () => {
      store.dispatch("CHECK_EDITED_AND_NOT_SAVE");
    };
    const minimizeWindow = () => window.electron.minimizeWindow();
    const maximizeWindow = () => window.electron.maximizeWindow();

    const isMaximized = computed(() => store.state.isMaximized);

    return {
      closeWindow,
      minimizeWindow,
      maximizeWindow,
      mdiWindowRestore,
      isMaximized,
    };
  },
});
</script>

<style scoped lang="scss">
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
