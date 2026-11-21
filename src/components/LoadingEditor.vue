<template>
  <div class="container">
    <EngineStartupOverlay :isCompletedInitialStartup="false" />
  </div>
</template>

<script setup lang="ts">
import EngineStartupOverlay from "./EngineStartupOverlay.vue";
</script>

<style lang="scss" scoped>
@use "@/styles/variables" as vars;

.container {
  position: relative;
  min-height: calc(100vh - #{vars.$menubar-height});
  overflow: hidden;
}
</style>
