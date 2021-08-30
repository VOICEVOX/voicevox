<template>
  <div class="root full-height q-py-sm" v-show="activeAudioKey" v-if="query">
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >話速 {{ currentAudioSpeedScale.toFixed(1) }}</span
      >
      <q-slider
        dense
        snap
        :min="0.5"
        :max="2"
        :step="0.1"
        :disable="uiLocked"
        :model-value="currentAudioSpeedScale"
        @update:model-value="setPreviewValue(previewAudioSpeedScale, $event)"
        @change="setAudioSpeedScale"
        @wheel="uiLocked || setAudioInfoByScroll(query, $event.deltaY, 'speed')"
        @pan="setPanning(previewAudioSpeedScale, $event)"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >音高 {{ currentAudioPitchScale.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        :min="-0.15"
        :max="0.15"
        :step="0.01"
        :disable="uiLocked"
        :model-value="currentAudioPitchScale"
        @update:model-value="setPreviewValue(previewAudioPitchScale, $event)"
        @change="setAudioPitchScale"
        @wheel="uiLocked || setAudioInfoByScroll(query, $event.deltaY, 'pitch')"
        @pan="setPanning(previewAudioPitchScale, $event)"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >抑揚 {{ currentIntonationScale.toFixed(1) }}</span
      >
      <q-slider
        dense
        snap
        :min="0"
        :max="2"
        :step="0.01"
        :disable="uiLocked"
        :model-value="currentIntonationScale"
        @update:model-value="
          setPreviewValue(previewAudioIntonationScale, $event)
        "
        @change="setAudioIntonationScale"
        @wheel="uiLocked || setAudioInfoByScroll(query, $event.deltaY, 'into')"
        @pan="setPanning(previewAudioIntonationScale, $event)"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >音量 {{ currentAudioVolumeScale.toFixed(1) }}</span
      >
      <q-slider
        dense
        snap
        :min="0"
        :max="2"
        :step="0.1"
        :disable="uiLocked"
        :model-value="currentAudioVolumeScale"
        @update:model-value="setPreviewValue(previewAudioVolumeScale, $event)"
        @change="setAudioVolumeScale"
        @wheel="
          uiLocked || setAudioInfoByScroll(query, $event.deltaY, 'volume')
        "
        @pan="setPanning(previewAudioVolumeScale, $event)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import {
  computed,
  reactive,
  ref,
  ComputedRef,
  defineComponent,
} from "vue";
import { useStore } from "@/store";
import {
  ACTIVE_AUDIO_KEY,
  SET_AUDIO_INTONATION_SCALE,
  SET_AUDIO_PITCH_SCALE,
  SET_AUDIO_SPEED_SCALE,
  SET_AUDIO_VOLUME_SCALE,
} from "@/store/audio";
import { UI_LOCKED } from "@/store/ui";
import { AudioQuery } from "@/openapi";

type PreviewableValue = {
  isPreview: boolean;

  storeValue: number | undefined;

  previewValue: number | undefined;
};

export default defineComponent({
  name: "AudioInfo",

  setup() {
    const createPreviewValue = (
      storeFunc: () => number | undefined
    ): [PreviewableValue, ComputedRef<number | undefined>] => {
      const previewObj: PreviewableValue = reactive({
        isPreview: false,
        storeValue: computed(storeFunc),
        previewValue: ref(storeFunc()),
      });

      const currentValue = computed(() =>
        previewObj.isPreview ? previewObj.previewValue : previewObj.storeValue
      );

      return [previewObj, currentValue];
    };

    const store = useStore();

    // accent phrase
    const activeAudioKey = computed<string | null>(
      () => store.getters[ACTIVE_AUDIO_KEY]
    );
    const uiLocked = computed(() => store.getters[UI_LOCKED]);

    const audioItem = computed(() =>
      activeAudioKey.value ? store.state.audioItems[activeAudioKey.value] : null
    );
    const query = computed(() => audioItem.value?.query);

    const [previewAudioSpeedScale, currentAudioSpeedScale] = createPreviewValue(
      () => query.value?.speedScale
    );

    const [previewAudioPitchScale, currentAudioPitchScale] = createPreviewValue(
      () => query.value?.pitchScale
    );

    const [previewAudioIntonationScale, currentIntonationScale] =
      createPreviewValue(() => query.value?.intonationScale);

    const [previewAudioVolumeScale, currentAudioVolumeScale] =
      createPreviewValue(() => query.value?.volumeScale);

    const setPreviewValue = (
      previewableValue: PreviewableValue,
      value: number
    ) => {
      previewableValue.isPreview = true;
      previewableValue.previewValue = value;
    };

    const setPanning = (
      previewableValue: PreviewableValue,
      panning: string
    ) => {
      previewableValue.isPreview = panning === "start";
      previewableValue.previewValue = previewableValue.storeValue;
    }

    const setAudioSpeedScale = (speedScale: number) => {
      previewAudioSpeedScale.isPreview = false;
      store.dispatch(SET_AUDIO_SPEED_SCALE, {
        audioKey: activeAudioKey.value!,
        speedScale,
      });
    };

    const setAudioPitchScale = (pitchScale: number) => {
      previewAudioPitchScale.isPreview = false;
      store.dispatch(SET_AUDIO_PITCH_SCALE, {
        audioKey: activeAudioKey.value!,
        pitchScale,
      });
    };

    const setAudioIntonationScale = (intonationScale: number) => {
      previewAudioIntonationScale.isPreview = false;
      store.dispatch(SET_AUDIO_INTONATION_SCALE, {
        audioKey: activeAudioKey.value!,
        intonationScale,
      });
    };

    const setAudioVolumeScale = (volumeScale: number) => {
      previewAudioVolumeScale.isPreview = false;
      store.dispatch(SET_AUDIO_VOLUME_SCALE, {
        audioKey: activeAudioKey.value!,
        volumeScale,
      });
    };

    type InfoType = "speed" | "pitch" | "into" | "volume";

    const setAudioInfoByScroll = (
      query: AudioQuery,
      delta_y: number,
      type: InfoType
    ) => {
      switch (type) {
        case "speed": {
          let curSpeed = query.speedScale - (delta_y > 0 ? 0.1 : -0.1);
          curSpeed = Math.round(curSpeed * 1e2) / 1e2;
          if (2 >= curSpeed && curSpeed >= 0.5) {
            setAudioSpeedScale(curSpeed);
          }
          break;
        }
        case "pitch": {
          let curPitch = query.pitchScale - (delta_y > 0 ? 0.01 : -0.01);
          curPitch = Math.round(curPitch * 1e2) / 1e2;
          if (0.15 >= curPitch && curPitch >= -0.15) {
            setAudioPitchScale(curPitch);
          }
          break;
        }
        case "into": {
          let curInto = query.intonationScale - (delta_y > 0 ? 0.1 : -0.1);
          curInto = Math.round(curInto * 1e1) / 1e1;
          if (2 >= curInto && curInto >= 0) {
            setAudioIntonationScale(curInto);
          }
          break;
        }
        case "volume": {
          let curVolume = query.volumeScale - (delta_y > 0 ? 0.1 : -0.1);
          curVolume = Math.round(curVolume * 1e1) / 1e1;
          if (2 >= curVolume && curVolume >= 0) {
            setAudioVolumeScale(curVolume);
          }
          break;
        }
        default:
          break;
      }
    };

    return {
      activeAudioKey,
      uiLocked,
      audioItem,
      query,
      previewAudioSpeedScale,
      previewAudioPitchScale,
      previewAudioIntonationScale,
      previewAudioVolumeScale,
      currentAudioSpeedScale,
      currentAudioPitchScale,
      currentIntonationScale,
      currentAudioVolumeScale,
      setPreviewValue,
      setAudioSpeedScale,
      setAudioPitchScale,
      setAudioIntonationScale,
      setAudioVolumeScale,
      setAudioInfoByScroll,
      setPanning,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles' as global;

.root {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-end;
  gap: 15px 0;
  overflow: hidden;
  bottom: 0;
}
</style>
