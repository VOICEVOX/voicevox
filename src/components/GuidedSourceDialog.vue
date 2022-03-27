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
            <q-btn
              v-if="!recording"
              round
              flat
              icon="radio_button_unchecked"
              color="warning"
              @click="startRecording"
            >
              <q-tooltip :delay="500" anchor="bottom left">
                Record from microphone
              </q-tooltip>
            </q-btn>
            <q-btn
              v-else
              round
              flat
              icon="stop"
              color="display"
              @click="stopRecording"
            >
              <q-tooltip :delay="500" anchor="bottom left">
                Finish Recording
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
            <div>{{ status }}</div>
          </template>
        </q-input>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ComputedRef, ref } from "vue";
import { useStore } from "@/store";
import Recorder from "recorder-js";

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
      () => store.state.audioItems[props.activeAudioKey].query?.guidedInfo
    );

    const audioElem = new Audio();

    const preview = () => {
      if (
        guidedInfo.value !== null &&
        guidedInfo.value !== undefined &&
        guidedInfo.value.audioPath !== ""
      ) {
        window.electron
          .readFile({ filePath: guidedInfo.value.audioPath })
          .then((array) => {
            if (array)
              store.dispatch("PLAY_AUDIO_BLOB", {
                audioBlob: new Blob([array], { type: "audio/wav" }),
                audioElem: audioElem,
              });
          });
      }
    };

    const selectAudioSource = async () => {
      const path = await window.electron.showOpenAudioDialog({
        title: "Select Audio Source",
      });
      if (path && guidedInfo.value !== undefined && guidedInfo.value !== null) {
        store.dispatch("SET_AUDIO_GUIDED_INFO", {
          audioKey: props.activeAudioKey,
          guidedInfo: { ...guidedInfo.value, audioPath: path },
        });
      }
    };

    type statusType = "Ready" | "Recording" | "File not specified";

    const recording = ref(false);

    const status: ComputedRef<statusType> = computed(() => {
      if (recording.value) {
        return "Recording";
      } else if (guidedInfo.value?.audioPath == "") {
        return "File not specified";
      } else {
        return "Ready";
      }
    });
    const audioContext = new window.AudioContext();

    const recorder = new Recorder(audioContext);

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => recorder.init(stream))
      .catch((err) => console.log("Uh oh... unable to get stream...", err));

    const startRecording = () => {
      recorder.start().then(() => {
        recording.value = true;
      });
    };

    const stopRecording = () => {
      recorder.stop().then(async ({ blob, buffer }) => {
        const date = new Date();
        window.electron
          .showAudioSaveDialog({
            title: "Save Recording",
            defaultPath: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}.wav`,
          })
          .then((path) => {
            if (
              path &&
              guidedInfo.value !== undefined &&
              guidedInfo.value !== null
            ) {
              blob.arrayBuffer().then((buf) => {
                window.electron.writeFile({
                  filePath: path,
                  buffer: buf,
                });
              });
              store.dispatch("SET_AUDIO_GUIDED_INFO", {
                audioKey: props.activeAudioKey,
                guidedInfo: { ...guidedInfo.value, audioPath: path },
              });
            }
          });
        recording.value = false;
        store.dispatch("PLAY_AUDIO_BLOB", {
          audioBlob: blob,
          audioElem: audioElem,
        });
      });
    };

    return {
      updateOpenDialog,
      preview,
      guidedInfo,
      selectAudioSource,
      status,
      recording,
      startRecording,
      stopRecording,
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
