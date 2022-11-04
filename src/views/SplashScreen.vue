<template>
  <div class="root">
    <div class="container">
      <q-space />
      <div class="title mx-auto">VOICEVOX</div>
      <q-linear-progress class="progress mx-auto" indeterminate />
      <div class="indent mx-auto">Loading...</div>
      <q-space />
    </div>
  </div>
  <div class="copyright">Version {{ version }}</div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";

export default defineComponent({
  name: "SplashScreen",
  setup() {
    const version = ref("0.0.0");
    window.electron.getAppInfos().then((obj) => {
      version.value = obj.version;
    });

    return { version };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

* {
  user-select: none;
  overflow: hidden;
}

.mx-auto {
  margin-left: auto;
  margin-right: auto;
}

.root {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  background-color: colors.$background;
}

.container {
  display: flex;
  height: 100%;
  width: 100%;
  flex-direction: column;
}

.title {
  text-align: center;
  text-transform: uppercase;
  color: colors.$primary;
  font-family: monospace;
  font-size: 300%;
  font-weight: bold;
}

.progress {
  width: 80%;
}

.indent {
  text-align: center;
  text-transform: capitalize;
  font-family: monospace;
  opacity: 0.6;
  color: colors.$display;
  margin-top: 0.5rem;
}

.copyright {
  position: fixed;
  bottom: 0;
  text-align: center;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0.5;
  font-size: small;
  margin-bottom: 1rem;
  font-family: monospace;
}
</style>
