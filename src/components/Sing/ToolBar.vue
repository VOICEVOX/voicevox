<template>
  <q-toolbar class="sing-toolbar">
    <!-- configs for entire song -->
    <div class="sing-configs">
      <character-menu-button />
      <q-input
        type="number"
        :model-value="keyShiftInputBuffer"
        label="ﾄﾗﾝｽﾎﾟｰｽﾞ"
        dense
        hide-bottom-space
        class="key-shift"
        @update:model-value="setKeyShiftInputBuffer"
        @change="setKeyShift"
      />
      <q-input
        type="number"
        :model-value="bpmInputBuffer"
        label="テンポ"
        dense
        hide-bottom-space
        class="sing-tempo"
        @update:model-value="setBpmInputBuffer"
        @change="setTempo"
      >
        <template #prepend>
          <q-icon name="music_note" size="xs" class="sing-tempo-icon" />
        </template>
      </q-input>
      <div class="sing-beats">
        <q-input
          type="number"
          :model-value="beatsInputBuffer"
          label="拍子"
          dense
          hide-bottom-space
          class="sing-time-signature"
          @update:model-value="setBeatsInputBuffer"
          @change="setTimeSignature"
        />
        <div class="sing-beats-separator">/</div>
        <q-input
          type="number"
          :model-value="beatTypeInputBuffer"
          label=""
          dense
          hide-bottom-space
          class="sing-time-signature"
          @update:model-value="setBeatTypeInputBuffer"
          @change="setTimeSignature"
        />
      </div>
    </div>
    <!-- player -->
    <div class="sing-player">
      <q-btn
        flat
        round
        class="sing-transport-button"
        icon="skip_previous"
        @click="goToZero"
      />
      <q-btn
        v-if="!nowPlaying"
        round
        class="sing-playback-button"
        icon="play_arrow"
        @click="play"
      />
      <q-btn
        v-else
        round
        class="sing-playback-button"
        icon="stop"
        @click="stop"
      />
      <div class="sing-playhead-position">
        <div>{{ playheadPositionMinSecStr }}</div>
        <div class="sing-playhead-position-millisec">
          .{{ playHeadPositionMilliSecStr }}
        </div>
      </div>
    </div>
    <!-- settings for edit controls -->
    <div class="sing-controls">
      <q-icon name="volume_up" size="xs" class="sing-volume-icon" />
      <q-slider v-model.number="volume" class="sing-volume" />
      <q-select
        v-model="snapTypeSelectModel"
        :options="snapTypeSelectOptions"
        outlined
        color="primary"
        dense
        text-color="display-on-primary"
        hide-bottom-space
        options-dense
        label="スナップ"
        transition-show="none"
        transition-hide="none"
        class="sing-snap"
      />
    </div>
  </q-toolbar>
</template>

<script setup lang="ts">
import { computed, watch, ref, onMounted, onUnmounted } from "vue";
import { useStore } from "@/store";
import {
  getSnapTypes,
  isTriplet,
  isValidBeatType,
  isValidBeats,
  isValidBpm,
  isValidVoiceKeyShift,
} from "@/sing/domain";
import CharacterMenuButton from "@/components/Sing/CharacterMenuButton/MenuButton.vue";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";

const store = useStore();
const { registerHotkeyWithCleanup } = useHotkeyManager();

registerHotkeyWithCleanup({
  editor: "song",
  name: "再生/停止",
  callback: () => {
    if (nowPlaying.value) {
      stop();
    } else {
      play();
    }
  },
});

const tempos = computed(() => store.state.tempos);
const timeSignatures = computed(() => store.state.timeSignatures);
const keyShift = computed(() => store.getters.SELECTED_TRACK.voiceKeyShift);

const bpmInputBuffer = ref(120);
const beatsInputBuffer = ref(4);
const beatTypeInputBuffer = ref(4);
const keyShiftInputBuffer = ref(0);

watch(
  tempos,
  () => {
    bpmInputBuffer.value = tempos.value[0].bpm;
  },
  { deep: true }
);

watch(
  timeSignatures,
  () => {
    beatsInputBuffer.value = timeSignatures.value[0].beats;
    beatTypeInputBuffer.value = timeSignatures.value[0].beatType;
  },
  { deep: true }
);

watch(keyShift, () => {
  keyShiftInputBuffer.value = keyShift.value;
});

const setBpmInputBuffer = (bpmStr: string | number | null) => {
  const bpmValue = Number(bpmStr);
  if (!isValidBpm(bpmValue)) {
    return;
  }
  bpmInputBuffer.value = bpmValue;
};

const setBeatsInputBuffer = (beatsStr: string | number | null) => {
  const beatsValue = Number(beatsStr);
  if (!isValidBeats(beatsValue)) {
    return;
  }
  beatsInputBuffer.value = beatsValue;
};

const setBeatTypeInputBuffer = (beatTypeStr: string | number | null) => {
  const beatTypeValue = Number(beatTypeStr);
  if (!isValidBeatType(beatTypeValue)) {
    return;
  }
  beatTypeInputBuffer.value = beatTypeValue;
};

const setKeyShiftInputBuffer = (keyShiftStr: string | number | null) => {
  const keyShiftValue = Number(keyShiftStr);
  if (!isValidVoiceKeyShift(keyShiftValue)) {
    return;
  }
  keyShiftInputBuffer.value = keyShiftValue;
};

const setTempo = () => {
  const bpm = bpmInputBuffer.value;
  store.dispatch("SET_TEMPO", {
    tempo: {
      position: 0,
      bpm,
    },
  });
};

const setTimeSignature = () => {
  const beats = beatsInputBuffer.value;
  const beatType = beatTypeInputBuffer.value;
  store.dispatch("SET_TIME_SIGNATURE", {
    timeSignature: {
      measureNumber: 1,
      beats,
      beatType,
    },
  });
};

const setKeyShift = () => {
  const voiceKeyShift = keyShiftInputBuffer.value;
  store.dispatch("SET_VOICE_KEY_SHIFT", { voiceKeyShift });
};

const playheadTicks = ref(0);

/// 再生時間の分と秒
const playheadPositionMinSecStr = computed(() => {
  const ticks = playheadTicks.value;
  const time = store.getters.TICK_TO_SECOND(ticks);

  const intTime = Math.trunc(time);
  const min = Math.trunc(intTime / 60);
  const minStr = String(min).padStart(2, "0");
  const secStr = String(intTime - min * 60).padStart(2, "0");

  return `${minStr}:${secStr}`;
});

const playHeadPositionMilliSecStr = computed(() => {
  const ticks = playheadTicks.value;
  const time = store.getters.TICK_TO_SECOND(ticks);
  const intTime = Math.trunc(time);
  const milliSec = Math.trunc((time - intTime) * 1000);
  const milliSecStr = String(milliSec).padStart(3, "0");
  return milliSecStr;
});

const nowPlaying = computed(() => store.state.nowPlaying);

const play = () => {
  store.dispatch("SING_PLAY_AUDIO");
};

const stop = () => {
  store.dispatch("SING_STOP_AUDIO");
};

const goToZero = () => {
  store.dispatch("SET_PLAYHEAD_POSITION", { position: 0 });
};

const volume = computed({
  get() {
    return store.state.volume * 100;
  },
  set(value: number) {
    store.dispatch("SET_VOLUME", { volume: value / 100 });
  },
});

const snapTypeSelectOptions = computed(() => {
  const tpqn = store.state.tpqn;
  return getSnapTypes(tpqn)
    .sort((a, b) => {
      if (isTriplet(a) === isTriplet(b)) {
        return a - b;
      } else {
        return isTriplet(a) ? 1 : -1;
      }
    })
    .map((snapType) => {
      if (isTriplet(snapType)) {
        return { snapType, label: `1/${(snapType / 3) * 2} T` };
      } else {
        return { snapType, label: `1/${snapType}` };
      }
    });
});
const snapTypeSelectModel = computed({
  get() {
    const snapType = store.state.sequencerSnapType;
    const selectOptions = snapTypeSelectOptions.value;
    return (
      selectOptions.find((value) => value.snapType === snapType) ??
      selectOptions[0]
    );
  },
  set(value) {
    store.dispatch("SET_SNAP_TYPE", {
      snapType: value.snapType,
    });
  },
});

const playheadPositionChangeListener = (position: number) => {
  playheadTicks.value = position;
};

onMounted(() => {
  store.dispatch("ADD_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });
});

onUnmounted(() => {
  store.dispatch("REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.q-input {
  :deep(.q-field__control::before) {
    border-color: rgba(colors.$display-rgb, 0.3);
  }
}

.q-select {
  :deep(.q-field__control::before) {
    border-color: rgba(colors.$display-rgb, 0.3);
  }
}

.sing-toolbar {
  background: colors.$sing-toolbar;
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-height: 56px;
  padding: 0 8px 0 0;
  width: 100%;
}

.sing-configs {
  align-items: center;
  display: flex;
  flex: 1;
}

.sing-player {
  align-items: center;
  justify-content: center;
  display: flex;
  flex: 1;
}

.key-shift {
  margin-left: 16px;
  margin-right: 4px;
  width: 50px;
}

.sing-tempo {
  margin-left: 8px;
  margin-right: 4px;
  width: 72px;
}

.sing-tempo-icon {
  color: rgba(colors.$display-rgb, 0.6);
  padding-right: 0px;
  position: relative;
  top: 4px;
  left: 0;
}

.sing-beats {
  align-items: center;
  display: flex;
  margin-left: 8px;
  position: relative;
}

.sing-time-signature {
  margin: 0;
  position: relative;
  width: 32px;
}
.sing-beats-separator {
  color: rgba(colors.$display-rgb, 0.6);
  position: relative;
  top: 5px;
  margin-right: 8px;
  pointer-events: none;
}

.sing-playhead-position {
  align-items: center;
  display: flex;
  font-size: 28px;
  font-weight: 700;
  margin-left: 16px;
  color: colors.$display;
}

.sing-playhead-position-millisec {
  font-size: 16px;
  font-weight: 700;
  margin: 10px 0 0 2px;
  color: rgba(colors.$display-rgb, 0.73);
}

.sing-controls {
  align-items: center;
  justify-content: flex-end;
  display: flex;
  flex: 1;
}

.sing-volume-icon {
  margin-right: 8px;
  opacity: 0.6;
}
.sing-volume {
  margin-right: 16px;
  width: 72px;
}

.sing-snap {
  min-width: 104px;
}
</style>
