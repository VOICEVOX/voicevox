<template>
  <Presentation v-model="modelValue" @exportAudio="handleExportAudio" />
</template>

<script setup lang="ts">
import { useStore } from "vuex";
import Presentation, { ExportTarget } from "./Presentation.vue";
import { SongExportSetting } from "@/store/type";

defineOptions({
  name: "ExportSongAudioDialog",
});

const modelValue = defineModel<boolean>();
const store = useStore();

const handleExportAudio = (
  target: ExportTarget,
  setting: SongExportSetting,
) => {
  if (target === "master") {
    void store.dispatch("EXPORT_WAVE_FILE", { setting });
  } else {
    void store.dispatch("EXPORT_STEM_WAVE_FILE", { setting });
  }
};
</script>
