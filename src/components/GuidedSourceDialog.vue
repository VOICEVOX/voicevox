<template>
  <q-dialog :model-value="openDialog" @update:model-value="updateOpenDialog">
    <q-card class="setting-card q-pa-md dialog-card">
      <q-card-section>
        <div class="text-h5">
          Guided: Manage Audio Source
          <q-btn round unelevated icon="settings" />
        </div>
      </q-card-section>
      <q-card-actions class="q-px-md q-py-sm">
        <q-input
          maxheight="10px"
          label="Audio Source"
          bottom-slots
          readonly
          :model-value="guidedInfo.audioPath"
          :input-style="{
            width: '350px',
          }"
          @update:model-value="() => {}"
        >
          <template v-slot:append>
            <q-btn
              round
              flat
              color="primary"
              icon="folder_open"
              @click="selectAudioSource"
            >
              <q-tooltip :delay="500" anchor="bottom left">
                Choose an audio source
              </q-tooltip>
            </q-btn>
            <q-btn round flat icon="radio_button_unchecked" color="warning">
              <q-tooltip :delay="500" anchor="bottom left">
                Record from microphone
              </q-tooltip>
            </q-btn>
          </template>
          <template v-slot:before>
            <q-btn
              flat
              round
              icon="play_arrow"
              class="bg-primary text-display"
              @click="preview"
            />
          </template>
          <template v-slot:hint>
            <div class="text-primary">{{ status }}</div>
          </template>
        </q-input>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref, Ref } from "vue";
import { useStore } from "@/store";

export default defineComponent({
  name: "GuidedSourceDialog",

  props: {
    openDialog: Boolean,
    activeAudioKey: { type: String, required: true },
  },

  emits: ["update:openDialog"],

  setup(props, context) {
    const updateOpenDialog = (isOpen: boolean) =>
      context.emit("update:openDialog", isOpen);

    const store = useStore();

    const guidedInfo = computed(
      () => store.state.audioItems[props.activeAudioKey].guidedInfo
    );

    const audioElem = new Audio();

    const preview = () => {
      if (guidedInfo.value !== undefined && guidedInfo.value.audioPath !== "") {
        window.electron
          .externalAudio(guidedInfo.value.audioPath)
          .then((array) => {
            console.log(array);
            if (array)
              store.dispatch("PLAY_AUDIO_BLOB", {
                audioBlob: new Blob([array], { type: "audio/wav" }),
                audioElem: audioElem,
              });
            console.log("?");
          });
      }
    };

    const selectAudioSource = async () => {
      const path = await window.electron.showOpenAudioDialog({
        title: "Select Audio Source",
      });
      if (path && guidedInfo.value !== undefined) {
        store.dispatch("SET_AUDIO_GUIDED_INFO", {
          audioKey: props.activeAudioKey,
          guidedInfo: { ...guidedInfo.value, audioPath: path },
        });
        console.log(path);
      }
    };

    type statusType = "Ready" | "Recording" | "Recording Finished";

    const status: Ref<statusType> = ref("Ready");

    return {
      updateOpenDialog,
      preview,
      guidedInfo,
      selectAudioSource,
      status,
    };
  },
});
</script>

<style>
.dialog-card {
  width: 700px;
  max-width: 80vw;
}
</style>
