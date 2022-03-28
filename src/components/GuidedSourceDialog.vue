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
              v-if="!previewing"
              flat
              round
              icon="play_arrow"
              class="bg-primary text-display"
              @click="startPreview"
            />
            <q-btn
              v-else
              flat
              round
              icon="stop"
              class="bg-primary text-display"
              @click="stopPreview"
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
import { GuidedInfo } from "@/type/preload";

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

    const guidedInfo = computed(() => {
      const audioItem = store.state.audioItems[props.activeAudioKey];
      if (
        audioItem.query?.guidedInfo === undefined ||
        audioItem.query.guidedInfo === null
      ) {
        const newGuidedInfo: GuidedInfo = {
          enabled: false,
          audioPath: "",
          normalize: false,
          precise: false,
        };
        store.dispatch("SET_AUDIO_GUIDED_INFO", {
          audioKey: props.activeAudioKey,
          guidedInfo: newGuidedInfo,
        });
        return newGuidedInfo;
      } else return audioItem.query.guidedInfo;
    });

    const audioElem = ref(new Audio());

    audioElem.value.addEventListener("ended", () => {
      previewing.value = false;
    });

    const previewing = ref(false);

    const startPreview = () => {
      if (guidedInfo.value.audioPath !== "") {
        window.electron
          .readFile({ filePath: guidedInfo.value.audioPath })
          .then((array) => {
            if (array) {
              store.dispatch("PLAY_AUDIO_BLOB", {
                audioBlob: new Blob([array], { type: "audio/wav" }),
                audioElem: audioElem.value,
              });
              previewing.value = true;
            }
          });
      }
    };

    const stopPreview = () => {
      previewing.value = false;
      audioElem.value.pause();
      audioElem.value.currentTime = 0;
    };

    const selectAudioSource = async () => {
      const path = await window.electron.showOpenAudioDialog({
        title: "Select Audio Source",
      });
      if (path)
        store.dispatch("SET_AUDIO_GUIDED_INFO", {
          audioKey: props.activeAudioKey,
          guidedInfo: { ...guidedInfo.value, audioPath: path },
        });
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

    const recorder = ref(new Recorder(audioContext));

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => recorder.value.init(stream))
      .catch((err) =>
        console.log("How could Chromium not support recording?", err)
      );

    const startRecording = () => {
      stopPreview();
      recorder.value.start().then(() => {
        recording.value = true;
      });
    };

    const stopRecording = () => {
      recorder.value.stop().then(({ blob, buffer }) => {
        const date = new Date();
        window.electron
          .showAudioSaveDialog({
            title: "Save Recording",
            defaultPath: `Recording-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}.wav`,
          })
          .then(async (path) => {
            if (path) {
              window.electron.writeFile({
                filePath: path,
                buffer: await blob.arrayBuffer(),
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
          audioElem: audioElem.value,
        });
      });
    };

    return {
      updateOpenDialog,
      previewing,
      startPreview,
      stopPreview,
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
