<template>
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
</template>

<script lang="ts">
import { defineComponent } from "vue";
import Mousetrap from "mousetrap";

export default defineComponent({
  name: "WindowButtons",
  setup() {
    const closeWindow = () => window.electron.closeWindow();
    const minimizeWindow = () => window.electron.minimizeWindow();
    const maximizeWindow = () => window.electron.maximizeWindow();

    Mousetrap.bind(["alt+f4", "ctrl+q"], closeWindow);

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
