<template>
  <Presentation v-model="modelValue" @exportAudio="handleExportAudio" />
</template>

<script setup lang="ts">
import { notifyResult } from "../Dialog";
import Presentation, { ExportTarget } from "./Presentation.vue";
import { useStore } from "@/store";
import { SaveResultObject, SongExportSetting } from "@/store/type";

defineOptions({
  name: "ExportSongAudioDialog",
});

const modelValue = defineModel<boolean>();
const store = useStore();

const handleExportAudio = async (
  target: ExportTarget,
  setting: SongExportSetting,
) => {
  let result: SaveResultObject;
  if (target === "master") {
    result = await store.actions.EXPORT_AUDIO_FILE({ setting });
  } else {
    result = await store.actions.EXPORT_STEM_AUDIO_FILE({ setting });
  }

  notifyResult(
    result,
    "audio",
    store.actions,
    store.state.confirmedTips.notifyOnGenerate,
  );
};
</script>
