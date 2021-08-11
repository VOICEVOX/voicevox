<template>
  <div class="root full-height q-py-sm" v-show="activeAudioKey" v-if="query">
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >話速 {{ query.speedScale.toFixed(1) }}</span
      >
      <q-slider
        dense
        snap
        :min="0.5"
        :max="2"
        :step="0.1"
        :disable="uiLocked"
        v-model="query.speedScale"
        @wheel="setAudioInfoByScroll(query, $event.deltaY, 'speed')"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >音高 {{ query.pitchScale.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        :min="-0.15"
        :max="0.15"
        :step="0.01"
        :disable="uiLocked"
        v-model="query.pitchScale"
        @wheel="setAudioInfoByScroll(query, $event.deltaY, 'pitch')"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >抑揚 {{ query.intonationScale.toFixed(1) }}</span
      >
      <q-slider
        dense
        snap
        :min="0"
        :max="2"
        :step="0.01"
        :disable="uiLocked"
        v-model="query.intonationScale"
        @wheel="setAudioInfoByScroll(query, $event.deltaY, 'into')"
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
import { AudioQuery } from "@/openapi";

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

    type InfoType = "speed" | "pitch" | "into";

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
            query.speedScale = curSpeed;
          }
          break;
        }
        case "pitch": {
          let curPitch = query.pitchScale - (delta_y > 0 ? 0.01 : -0.01);
          curPitch = Math.round(curPitch * 1e2) / 1e2;
          if (0.15 >= curPitch && curPitch >= -0.15) {
            query.pitchScale = curPitch;
          }
          break;
        }
        case "into": {
          let curInto = query.intonationScale - (delta_y > 0 ? 0.1 : -0.1);
          curInto = Math.round(curInto * 1e1) / 1e1;
          if (2 >= curInto && curInto >= 0) {
            query.intonationScale = curInto;
          }
          break;
        }
        default:
          break;
      }
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
      setAudioInfoByScroll,
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
