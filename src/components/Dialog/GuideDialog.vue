<template>
  <QDialog v-model="dialogOpened">
    <QCard class="q-pa-md">
      <div class="guide-title">Guide</div>
      <div class="audio-selection-container">
        <div>{{ audioDisplayName }}</div>
        <QBtn flat icon="folder_open" dense @click="pickAudioFile" />
      </div>

      <QExpansionItem dense label="Advanced Settings">
        <QList>
          <QItem>
            <QToggle
              v-model="advancedSettings.normalize"
              label="Normalize Pitch"
              dense
            />
          </QItem>
          <QItem>
            <QToggle
              v-model="advancedSettings.assignLength"
              label="Apply Duration"
              dense
            />
          </QItem>
          <QItem>
            <QToggle
              v-model="advancedSettings.assignPitch"
              label="Apply Pitch"
              dense
            />
          </QItem>
          <QItem>
            <QToggle
              v-model="advancedSettings.trimAudio"
              label="Trim Audio"
              dense
            />
          </QItem>
        </QList>
      </QExpansionItem>
      <div style="display: flex">
        <QSpace />
        <QBtn flat dense label="Confirm" @click="guide" />
      </div>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "@/store";

const store = useStore();

const dialogOpened = defineModel<boolean>("dialogOpened");

const audioFilePath = ref<string | null>(null);
const audioFileBlob = ref<Blob | null>(null);

const advancedSettings = ref({
  trim: false,
  normalize: true,
  assignLength: true,
  assignPitch: true,
  trimAudio: true,
});

const audioDisplayName = computed(() => {
  if (audioFilePath.value == null) {
    return "No audio file selected.";
  } else {
    return `Selected: ${audioFilePath.value.split("/").pop()} `;
  }
});

const pickAudioFile = async () => {
  const audioPath = await window.backend.showOpenFileDialog({
    title: "Select Audio File",
    name: "",
    mimeType: "audio/*",
    extensions: ["*"],
  });
  if (audioPath == undefined) {
    return;
  }
  try {
    // Result<Uint8Array<ArrayBufferLike>>
    const audioArray = await window.backend.readFile({ filePath: audioPath });
    if (audioArray.ok) {
      // dirty cast to satisfy TS
      audioFileBlob.value = new Blob([audioArray.value as unknown as BlobPart]);
    } else {
      console.error("Failed to read audio file:", audioArray.error);
    }
  } catch (error) {
    console.error("Error reading audio file:", error);
  }
  audioFilePath.value = audioPath;
};

const guide = () => {
  const audioKey = store.getters.ACTIVE_AUDIO_KEY;
  if (audioKey == undefined || audioFileBlob.value == null) {
    return;
  }
  const engineId = store.state.audioItems[audioKey].voice.engineId;
  store.actions
    .GUIDE_AUDIO_QUERY({
      engineId: engineId,
      audioKey: audioKey,
      refAudio: audioFileBlob.value,
      ...advancedSettings.value,
    })
    .catch((error) => {
      console.error("Error guiding audio query:", error);
    });
  dialogOpened.value = false;
};
</script>

<style scoped lang="scss">
.guide-title {
  font-size: 1.5rem;
  font-weight: bold;
}
.audio-selection-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
</style>
