<template>
  <Presentation v-model="modelValue" @exportTrack="handleExportTrack" />
</template>

<script setup lang="ts">
import Presentation, { ExportAudioSetting } from "./Presentation.vue";

defineOptions({
  name: "ExportSongAudioDialog",
});

const modelValue = defineModel<boolean>();

const handleExportTrack = (setting: ExportAudioSetting) => {
  console.log(setting);
};
</script>

<style scoped lang="scss">
.dialog-card {
  width: 700px;
  max-width: 80vw;
}

.scrollable-area {
  overflow-y: auto;
  max-height: calc(100vh - 100px - 295px);
}
</style>
