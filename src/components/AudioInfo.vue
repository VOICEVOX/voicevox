<template>
  <div class="root" v-show="activeAudioKey">
    <div>
      <div>話速</div>
      <div>{{ query?.speedScale }}</div>
      <input
        type="range"
        min="0.5"
        max="2"
        step="0.1"
        :value="query?.speedScale"
        @change="setAudioSpeedScale(parseFloat($event.target.value))"
        :disabled="uiLocked"
      />
    </div>
    <div>
      <div>音高</div>
      <div>{{ query?.pitchScale }}</div>
      <input
        type="range"
        min="-0.15"
        max="0.15"
        step="0.01"
        :value="query?.pitchScale"
        @change="setAudioPitchScale(parseFloat($event.target.value))"
        :disabled="uiLocked"
      />
    </div>
    <div>
      <div>抑揚</div>
      <div>{{ query?.intonationScale }}</div>
      <input
        type="range"
        min="0"
        max="2"
        step="0.01"
        :value="query?.intonationScale"
        @change="setAudioIntonationScale(parseFloat($event.target.value))"
        :disabled="uiLocked"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { useStore } from "@/store";
import {
  ACTIVE_AUDIO_KEY,
  SET_AUDIO_INTONATION_SCALE,
  SET_AUDIO_PITCH_SCALE,
  SET_AUDIO_SPEED_SCALE,
} from "@/store/audio";
import { UI_LOCKED } from "@/store/ui";

export default defineComponent({
  name: "AudioInfo",

  setup() {
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

    const setAudioSpeedScale = (speedScale: number) => {
      store.dispatch(SET_AUDIO_SPEED_SCALE, {
        audioKey: activeAudioKey.value!,
        speedScale,
      });
    };

    const setAudioPitchScale = (pitchScale: number) => {
      store.dispatch(SET_AUDIO_PITCH_SCALE, {
        audioKey: activeAudioKey.value!,
        pitchScale,
      });
    };

    const setAudioIntonationScale = (intonationScale: number) => {
      store.dispatch(SET_AUDIO_INTONATION_SCALE, {
        audioKey: activeAudioKey.value!,
        intonationScale,
      });
    };

    return {
      activeAudioKey,
      uiLocked,
      audioItem,
      query,
      setAudioSpeedScale,
      setAudioPitchScale,
      setAudioIntonationScale,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles' as global;

@use "@material/fab";

.root {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-end;
  padding: 10px 0;
  gap: 20px 0;

  > div {
    padding: 0 10px;
    > div {
      display: inline-block;
      margin: 0 5px;
    }
    input {
      width: 100%;
    }
  }
}
</style>
