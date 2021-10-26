<template>
  <div class="root full-height q-py-md" v-if="query">
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >話速 {{ speedScaleSlider.state.currentValue.value?.toFixed(1) }}</span
      >
      <q-slider
        dense
        snap
        :min="speedScaleSlider.qSliderProps.min.value"
        :max="speedScaleSlider.qSliderProps.max.value"
        :step="speedScaleSlider.qSliderProps.step.value"
        :disable="speedScaleSlider.qSliderProps.disable.value"
        :model-value="speedScaleSlider.qSliderProps.modelValue.value"
        @update:model-value="
          speedScaleSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="speedScaleSlider.qSliderProps.onChange"
        @wheel="speedScaleSlider.qSliderProps.onWheel"
        @pan="speedScaleSlider.qSliderProps.onPan"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >音高 {{ pitchScaleSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        :min="pitchScaleSlider.qSliderProps.min.value"
        :max="pitchScaleSlider.qSliderProps.max.value"
        :step="pitchScaleSlider.qSliderProps.step.value"
        :disable="pitchScaleSlider.qSliderProps.disable.value"
        :model-value="pitchScaleSlider.qSliderProps.modelValue.value"
        @update:model-value="
          pitchScaleSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="pitchScaleSlider.qSliderProps.onChange"
        @wheel="pitchScaleSlider.qSliderProps.onWheel"
        @pan="pitchScaleSlider.qSliderProps.onPan"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >抑揚
        {{ intonationScaleSlider.state.currentValue.value?.toFixed(1) }}</span
      >
      <q-slider
        dense
        snap
        :min="intonationScaleSlider.qSliderProps.min.value"
        :max="intonationScaleSlider.qSliderProps.max.value"
        :step="intonationScaleSlider.qSliderProps.step.value"
        :disable="intonationScaleSlider.qSliderProps.disable.value"
        :model-value="intonationScaleSlider.qSliderProps.modelValue.value"
        @update:model-value="
          intonationScaleSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="intonationScaleSlider.qSliderProps.onChange"
        @wheel="intonationScaleSlider.qSliderProps.onWheel"
        @pan="intonationScaleSlider.qSliderProps.onPan"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >音量 {{ volumeScaleSlider.state.currentValue.value?.toFixed(1) }}</span
      >
      <q-slider
        dense
        snap
        :min="volumeScaleSlider.qSliderProps.min.value"
        :max="volumeScaleSlider.qSliderProps.max.value"
        :step="volumeScaleSlider.qSliderProps.step.value"
        :disable="volumeScaleSlider.qSliderProps.disable.value"
        :model-value="volumeScaleSlider.qSliderProps.modelValue.value"
        @update:model-value="
          volumeScaleSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="volumeScaleSlider.qSliderProps.onChange"
        @wheel="volumeScaleSlider.qSliderProps.onWheel"
        @pan="volumeScaleSlider.qSliderProps.onPan"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >開始無音
        {{ prePhonemeLengthSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        :min="prePhonemeLengthSlider.qSliderProps.min.value"
        :max="prePhonemeLengthSlider.qSliderProps.max.value"
        :step="prePhonemeLengthSlider.qSliderProps.step.value"
        :disable="prePhonemeLengthSlider.qSliderProps.disable.value"
        :model-value="prePhonemeLengthSlider.qSliderProps.modelValue.value"
        @update:model-value="
          prePhonemeLengthSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="prePhonemeLengthSlider.qSliderProps.onChange"
        @wheel="prePhonemeLengthSlider.qSliderProps.onWheel"
        @pan="prePhonemeLengthSlider.qSliderProps.onPan"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >終了無音
        {{ postPhonemeLengthSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        :min="postPhonemeLengthSlider.qSliderProps.min.value"
        :max="postPhonemeLengthSlider.qSliderProps.max.value"
        :step="postPhonemeLengthSlider.qSliderProps.step.value"
        :disable="postPhonemeLengthSlider.qSliderProps.disable.value"
        :model-value="postPhonemeLengthSlider.qSliderProps.modelValue.value"
        @update:model-value="
          postPhonemeLengthSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="postPhonemeLengthSlider.qSliderProps.onChange"
        @wheel="postPhonemeLengthSlider.qSliderProps.onWheel"
        @pan="postPhonemeLengthSlider.qSliderProps.onPan"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { useStore } from "@/store";
import { previewSliderHelper } from "@/helpers/previewSliderHelper";

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

    const speedScaleSlider = previewSliderHelper({
      modelValue: () => query.value?.speedScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioSpeedScale,
      max: () => 2,
      min: () => 0.5,
      step: () => 0.1,
      scrollStep: () => 0.1,
      scrollMinStep: () => 0.01,
    });
    const pitchScaleSlider = previewSliderHelper({
      modelValue: () => query.value?.pitchScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioPitchScale,
      max: () => 0.15,
      min: () => -0.15,
      step: () => 0.01,
      scrollStep: () => 0.01,
    });
    const intonationScaleSlider = previewSliderHelper({
      modelValue: () => query.value?.intonationScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioIntonationScale,
      max: () => 2,
      min: () => 0,
      step: () => 0.1,
      scrollStep: () => 0.1,
      scrollMinStep: () => 0.01,
    });
    const volumeScaleSlider = previewSliderHelper({
      modelValue: () => query.value?.volumeScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioVolumeScale,
      max: () => 2,
      min: () => 0,
      step: () => 0.1,
      scrollStep: () => 0.1,
      scrollMinStep: () => 0.01,
    });
    const prePhonemeLengthSlider = previewSliderHelper({
      modelValue: () => query.value?.prePhonemeLength ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioPrePhonemeLength,
      max: () => 1.5,
      min: () => 0,
      step: () => 0.1,
      scrollStep: () => 0.1,
      scrollMinStep: () => 0.01,
    });
    const postPhonemeLengthSlider = previewSliderHelper({
      modelValue: () => query.value?.postPhonemeLength ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioPostPhonemeLength,
      max: () => 1.5,
      min: () => 0,
      step: () => 0.1,
      scrollStep: () => 0.1,
      scrollMinStep: () => 0.01,
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
