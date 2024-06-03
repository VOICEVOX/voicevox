<template>
  <QToolbar class="sing-toolbar">
    <!-- configs for entire song -->
    <div class="sing-configs">
      <CharacterMenuButton />
      <QInput
        type="number"
        :modelValue="keyRangeAdjustmentInputBuffer"
        label="音域調整"
        dense
        hideBottomSpace
        class="key-range-adjustment"
        @update:modelValue="setKeyRangeAdjustmentInputBuffer"
        @change="setKeyRangeAdjustment"
      />
      <QInput
        type="number"
        :modelValue="volumeRangeAdjustmentInputBuffer"
        label="声量調整"
        dense
        hideBottomSpace
        class="volume-range-adjustment"
        @update:modelValue="setVolumeRangeAdjustmentInputBuffer"
        @change="setVolumeRangeAdjustment"
      />
      <QInput
        type="number"
        :modelValue="bpmInputBuffer"
        label="テンポ"
        dense
        hideBottomSpace
        class="sing-tempo"
        @update:modelValue="setBpmInputBuffer"
        @change="setTempo"
      >
        <template #prepend>
          <QIcon name="music_note" size="xs" class="sing-tempo-icon" />
        </template>
      </QInput>
      <div class="sing-beats">
        <QInput
          type="number"
          :modelValue="beatsInputBuffer"
          label="拍子"
          dense
          hideBottomSpace
          class="sing-time-signature"
          @update:modelValue="setBeatsInputBuffer"
          @change="setTimeSignature"
        />
        <div class="sing-beats-separator">/</div>
        <QInput
          type="number"
          :modelValue="beatTypeInputBuffer"
          label=""
          dense
          hideBottomSpace
          class="sing-time-signature"
          @update:modelValue="setBeatTypeInputBuffer"
          @change="setTimeSignature"
        />
      </div>
    </div>
    <!-- player -->
    <div class="sing-player">
      <QBtn
        flat
        round
        class="sing-transport-button"
        icon="skip_previous"
        @click="goToZero"
      />
      <QBtn
        v-if="!nowPlaying"
        round
        class="sing-playback-button"
        icon="play_arrow"
        @click="play"
      />
      <QBtn
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
      <EditTargetSwicher
        v-if="showEditTargetSwitchButton"
        :editTarget
        :changeEditTarget
      />
      <QBtn
        flat
        dense
        round
        icon="undo"
        class="sing-undo-button"
        :disable="!canUndo"
        @click="undo"
      />
      <QBtn
        flat
        dense
        round
        icon="redo"
        class="sing-redo-button"
        :disable="!canRedo"
        @click="redo"
      />
      <QIcon name="volume_up" size="xs" class="sing-volume-icon" />
      <QSlider v-model.number="volume" class="sing-volume" />
      <QSelect
        v-model="snapTypeSelectModel"
        :options="snapTypeSelectOptions"
        outlined
        color="primary"
        dense
        textColor="display-on-primary"
        hideBottomSpace
        optionsDense
        label="スナップ"
        transitionShow="none"
        transitionHide="none"
        class="sing-snap"
      />
    </div>
  </QToolbar>
</template>

<script setup lang="ts">
import { computed, watch, ref, onMounted, onUnmounted } from "vue";
import EditTargetSwicher from "./EditTargetSwicher.vue";
import { useStore } from "@/store";

import {
  getSnapTypes,
  isTriplet,
  isValidBeatType,
  isValidBeats,
  isValidBpm,
  isValidKeyRangeAdjustment,
  isValidVolumeRangeAdjustment,
} from "@/sing/domain";
import CharacterMenuButton from "@/components/Sing/CharacterMenuButton/MenuButton.vue";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import { SequencerEditTarget } from "@/store/type";

const store = useStore();

const uiLocked = computed(() => store.getters.UI_LOCKED);
const editor = "song";
const canUndo = computed(() => store.getters.CAN_UNDO(editor));
const canRedo = computed(() => store.getters.CAN_REDO(editor));

const { registerHotkeyWithCleanup } = useHotkeyManager();
registerHotkeyWithCleanup({
  editor,
  name: "元に戻す",
  callback: () => {
    if (!uiLocked.value && canUndo.value) {
      undo();
    }
  },
});
registerHotkeyWithCleanup({
  editor,
  name: "やり直す",
  callback: () => {
    if (!uiLocked.value && canRedo.value) {
      redo();
    }
  },
});

registerHotkeyWithCleanup({
  editor,
  name: "再生/停止",
  callback: () => {
    if (nowPlaying.value) {
      stop();
    } else {
      play();
    }
  },
});

const undo = () => {
  store.dispatch("UNDO", { editor });
};
const redo = () => {
  store.dispatch("REDO", { editor });
};

const showEditTargetSwitchButton = computed(() => {
  return store.state.experimentalSetting.enablePitchEditInSongEditor;
});

const editTarget = computed(() => store.state.sequencerEditTarget);

const changeEditTarget = (editTarget: SequencerEditTarget) => {
  store.dispatch("SET_EDIT_TARGET", { editTarget });
};

const tempos = computed(() => store.state.tempos);
const timeSignatures = computed(() => store.state.timeSignatures);
const keyRangeAdjustment = computed(
  () => store.getters.SELECTED_TRACK.keyRangeAdjustment,
);
const volumeRangeAdjustment = computed(
  () => store.getters.SELECTED_TRACK.volumeRangeAdjustment,
);

const bpmInputBuffer = ref(120);
const beatsInputBuffer = ref(4);
const beatTypeInputBuffer = ref(4);
const keyRangeAdjustmentInputBuffer = ref(0);
const volumeRangeAdjustmentInputBuffer = ref(0);

watch(
  tempos,
  () => {
    bpmInputBuffer.value = tempos.value[0].bpm;
  },
  { deep: true, immediate: true },
);

watch(
  timeSignatures,
  () => {
    beatsInputBuffer.value = timeSignatures.value[0].beats;
    beatTypeInputBuffer.value = timeSignatures.value[0].beatType;
  },
  { deep: true, immediate: true },
);

watch(
  keyRangeAdjustment,
  () => {
    keyRangeAdjustmentInputBuffer.value = keyRangeAdjustment.value;
  },
  { immediate: true },
);

watch(
  volumeRangeAdjustment,
  () => {
    volumeRangeAdjustmentInputBuffer.value = volumeRangeAdjustment.value;
  },
  { immediate: true },
);

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

const setKeyRangeAdjustmentInputBuffer = (
  KeyRangeAdjustmentStr: string | number | null,
) => {
  const KeyRangeAdjustmentValue = Number(KeyRangeAdjustmentStr);
  if (!isValidKeyRangeAdjustment(KeyRangeAdjustmentValue)) {
    return;
  }
  keyRangeAdjustmentInputBuffer.value = KeyRangeAdjustmentValue;
};

const setVolumeRangeAdjustmentInputBuffer = (
  volumeRangeAdjustmentStr: string | number | null,
) => {
  const volumeRangeAdjustmentValue = Number(volumeRangeAdjustmentStr);
  if (!isValidVolumeRangeAdjustment(volumeRangeAdjustmentValue)) {
    return;
  }
  volumeRangeAdjustmentInputBuffer.value = volumeRangeAdjustmentValue;
};

const setTempo = () => {
  const bpm = bpmInputBuffer.value;
  store.dispatch("COMMAND_SET_TEMPO", {
    tempo: {
      position: 0,
      bpm,
    },
  });
};

const setTimeSignature = () => {
  const beats = beatsInputBuffer.value;
  const beatType = beatTypeInputBuffer.value;
  store.dispatch("COMMAND_SET_TIME_SIGNATURE", {
    timeSignature: {
      measureNumber: 1,
      beats,
      beatType,
    },
  });
};

const setKeyRangeAdjustment = () => {
  const keyRangeAdjustment = keyRangeAdjustmentInputBuffer.value;
  store.dispatch("COMMAND_SET_KEY_RANGE_ADJUSTMENT", { keyRangeAdjustment });
};

const setVolumeRangeAdjustment = () => {
  const volumeRangeAdjustment = volumeRangeAdjustmentInputBuffer.value;
  store.dispatch("COMMAND_SET_VOLUME_RANGE_ADJUSTMENT", {
    volumeRangeAdjustment,
  });
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
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

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

.key-range-adjustment {
  margin-left: 16px;
  margin-right: 4px;
  width: 50px;
}

.volume-range-adjustment {
  margin-left: 4px;
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

.sing-undo-button,
.sing-redo-button {
  &.disabled {
    opacity: 0.4 !important;
  }
}
.sing-redo-button {
  margin-right: 16px;
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
