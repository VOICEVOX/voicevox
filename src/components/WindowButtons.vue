<template>
  <div v-if="$q.platform.is.mac">
    <q-btn
      dense
      flat
      round
      icon="lens"
      color="green"
      class="windowButtons"
      @click="minimizeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      round
      icon="lens"
      color="yellow"
      class="windowButtons"
      @click="maximizeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      icon="lens"
      color="red"
      class="windowButtons"
      @click="closeWindow()"
    ></q-btn>
  </div>
  <div v-else>
    <q-btn
      dense
      flat
      icon="minimize"
      class="windowButtons"
      @click="minimizeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      icon="crop_square"
      class="windowButtons"
      @click="maximizeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      icon="close"
      class="windowButtons"
      id="close"
      @click="closeWindow()"
    ></q-btn>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import Mousetrap from "mousetrap";
import { ipcRenderer } from "electron/renderer";

export default defineComponent({
  name: "WindowButtons",
  setup() {
    const closeWindow = () => ipcRenderer.invoke("CLOSE_WINDOW");
    const minimizeWindow = () => ipcRenderer.invoke("MINIMIZE_WINDOW");
    const maximizeWindow = () => ipcRenderer.invoke("MAXIMIZE_WINDOW");

    Mousetrap.bind(["alt+f4", "ctrl+q", "command+q"], closeWindow);
    Mousetrap.bind(["ctrl+m", "command+m"], minimizeWindow);

    return {
      closeWindow,
      minimizeWindow,
      maximizeWindow,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;

.windowButtons {
  -webkit-app-region: no-drag;
}

#close:hover {
  background-color: red;
}
</style>
