<template>
  <div class="root full-height q-py-md" v-if="query">
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >話速 {{ speedScaleSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider dense snap v-bind="speedScaleSlider.qSliderProps.value" />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >音高 {{ pitchScaleSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider dense snap v-bind="pitchScaleSlider.qSliderProps.value" />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >抑揚
        {{ intonationScaleSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider dense snap v-bind="intonationScaleSlider.qSliderProps.value" />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >音量 {{ volumeScaleSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider dense snap v-bind="volumeScaleSlider.qSliderProps.value" />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >開始無音
        {{ prePhonemeLengthSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider dense snap v-bind="prePhonemeLengthSlider.qSliderProps.value" />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >終了無音
        {{ postPhonemeLengthSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        v-bind="postPhonemeLengthSlider.qSliderProps.value"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { useStore } from "@/store";
import { usePreviewSlider } from "@/helpers/usePreviewSlider";
import { getterObject } from "@/helpers/funcUtils";

export default defineComponent({
  name: "AudioInfo",

  props: {
    activeAudioKey: { type: String, required: true },
  },

  setup(props) {
    const store = useStore();

    // accent phrase
    const uiLocked = computed(() => store.getters.UI_LOCKED);

    const audioItem = computed(
      () => store.state.audioItems[props.activeAudioKey]
    );
    const query = computed(() => audioItem.value?.query);

    const setAudioSpeedScale = (speedScale: number) => {
      store.dispatch("COMMAND_SET_AUDIO_SPEED_SCALE", {
        audioKey: props.activeAudioKey,
        speedScale,
      });
    };

    const setAudioPitchScale = (pitchScale: number) => {
      store.dispatch("COMMAND_SET_AUDIO_PITCH_SCALE", {
        audioKey: props.activeAudioKey,
        pitchScale,
      });
    };

    const setAudioIntonationScale = (intonationScale: number) => {
      store.dispatch("COMMAND_SET_AUDIO_INTONATION_SCALE", {
        audioKey: props.activeAudioKey,
        intonationScale,
      });
    };

    const setAudioVolumeScale = (volumeScale: number) => {
      store.dispatch("COMMAND_SET_AUDIO_VOLUME_SCALE", {
        audioKey: props.activeAudioKey,
        volumeScale,
      });
    };

    const setAudioPrePhonemeLength = (prePhonemeLength: number) => {
      store.dispatch("COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH", {
        audioKey: props.activeAudioKey,
        prePhonemeLength,
      });
    };

    const setAudioPostPhonemeLength = (postPhonemeLength: number) => {
      store.dispatch("COMMAND_SET_AUDIO_POST_PHONEME_LENGTH", {
        audioKey: props.activeAudioKey,
        postPhonemeLength,
      });
    };

    const speedScaleSlider = usePreviewSlider({
      modelValue: () => query.value?.speedScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioSpeedScale,
      ...getterObject({
        max: 2,
        min: 0.5,
        step: 0.01,
        scrollStep: 0.1,
        scrollMinStep: 0.01,
      }),
    });
    const pitchScaleSlider = usePreviewSlider({
      modelValue: () => query.value?.pitchScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioPitchScale,
      ...getterObject({
        max: 0.15,
        min: -0.15,
        step: 0.01,
        scrollStep: 0.05,
        scrollMinStep: 0.01,
      }),
    });
    const intonationScaleSlider = usePreviewSlider({
      modelValue: () => query.value?.intonationScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioIntonationScale,
      ...getterObject({
        max: 2,
        min: 0,
        step: 0.01,
        scrollStep: 0.1,
        scrollMinStep: 0.01,
      }),
    });
    const volumeScaleSlider = usePreviewSlider({
      modelValue: () => query.value?.volumeScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioVolumeScale,
      ...getterObject({
        max: 2,
        min: 0,
        step: 0.01,
        scrollStep: 0.1,
        scrollMinStep: 0.01,
      }),
    });
    const prePhonemeLengthSlider = usePreviewSlider({
      modelValue: () => query.value?.prePhonemeLength ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioPrePhonemeLength,
      ...getterObject({
        max: 1.5,
        min: 0,
        step: 0.01,
        scrollStep: 0.1,
        scrollMinStep: 0.01,
      }),
    });
    const postPhonemeLengthSlider = usePreviewSlider({
      modelValue: () => query.value?.postPhonemeLength ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioPostPhonemeLength,
      ...getterObject({
        max: 1.5,
        min: 0,
        step: 0.01,
        scrollStep: 0.1,
        scrollMinStep: 0.01,
      }),
    });

    return {
      uiLocked,
      audioItem,
      query,
      speedScaleSlider,
      pitchScaleSlider,
      intonationScaleSlider,
      volumeScaleSlider,
      prePhonemeLengthSlider,
      postPhonemeLengthSlider,
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
  justify-content: flex-start;
  gap: 15px 0;
  overflow-y: scroll;
}
</style>
