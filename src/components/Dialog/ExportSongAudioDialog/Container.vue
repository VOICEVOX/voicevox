<template>
  <Presentation v-model="modelValue" @exportAudio="handleExportAudio" />
</template>

<script setup lang="ts">
import Presentation, { ExportTarget } from "./Presentation.vue";
import { useStore } from "@/store";
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
    void store.dispatch("EXPORT_AUDIO_FILE", { setting });
  } else {
    void store.dispatch("EXPORT_STEM_AUDIO_FILE", { setting });
  }
};
</script>
