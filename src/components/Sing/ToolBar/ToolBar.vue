<template>
  <QToolbar class="sing-toolbar">
    <!-- configs for entire song -->
    <div class="sing-configs">
      <CharacterMenuButton />
      <QInput
        type="number"
        :model-value="keyRangeAdjustmentInputBuffer"
        label="音域調整"
        dense
        hide-bottom-space
        class="key-range-adjustment"
        @update:model-value="setKeyRangeAdjustmentInputBuffer"
        @change="setKeyRangeAdjustment"
      />
      <QInput
        type="number"
        :model-value="volumeRangeAdjustmentInputBuffer"
        label="声量調整"
        dense
        hide-bottom-space
        class="volume-range-adjustment"
        @update:model-value="setVolumeRangeAdjustmentInputBuffer"
        @change="setVolumeRangeAdjustment"
      />
      <QInput
        type="number"
        :model-value="bpmInputBuffer"
        dense
        hide-bottom-space
        standout
        class="sing-tempo"
        @update:model-value="setBpmInputBuffer"
        @change="setTempo"
      />
      <QField hide-bottom-space dense>
        <div class="sing-beats">
          <QSelect
            :model-value="timeSignatures[0].beats"
            :options="beatsOptions"
            hide-bottom-space
            hide-dropdown-icon
            user-inputs
            standout
            dense
            options-dense
            transition-show="none"
            transition-hide="none"
            class="sing-time-signature"
            @update:model-value="setBeats"
          />
          <div class="sing-beats-separator">/</div>
          <QSelect
            :model-value="timeSignatures[0].beatType"
            :options="beatTypeOptions"
            hide-bottom-space
            hide-dropdown-icon
            user-inputs
            standout
            dense
            options-dense
            transition-show="none"
            transition-hide="none"
            class="sing-time-signature"
            @update:model-value="setBeatType"
          />
        </div>
      </QField>
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
        :edit-target="editTarget"
        :change-edit-target="changeEditTarget"
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
        standout
        color="primary"
        text-color="display-on-primary"
        hide-bottom-space
        options-dense
        hide-dropdown-icon
        label="スナップ"
        transition-show="none"
        transition-hide="none"
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
  isValidvolumeRangeAdjustment,
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

const beatsOptions = computed(() => {
  return Array.from({ length: 32 }, (_, i) => ({
    label: (i + 1).toString(),
    value: i + 1,
  }));
});

const beatTypeOptions = computed(() => {
  return [2, 4, 8, 16, 32].map((beatType) => ({
    label: beatType.toString(),
    value: beatType,
  }));
});

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

const setBeats = (beats: { label: string; value: number }) => {
  if (!isValidBeats(beats.value)) {
    return;
  }
  store.dispatch("COMMAND_SET_TIME_SIGNATURE", {
    timeSignature: {
      measureNumber: 1,
      beats: beats.value,
      beatType: timeSignatures.value[0].beatType,
    },
  });
};

const setBeatType = (beatType: { label: string; value: number }) => {
  if (!isValidBeatType(beatType.value)) {
    return;
  }
  store.dispatch("COMMAND_SET_TIME_SIGNATURE", {
    timeSignature: {
      measureNumber: 1,
      beats: timeSignatures.value[0].beats,
      beatType: beatType.value,
    },
  });
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
  if (!isValidvolumeRangeAdjustment(volumeRangeAdjustmentValue)) {
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
    border-color: var(--md-sys-color-outline);
  }
}

.q-select {
  :deep(.q-field__control::before) {
    border-color: var(--md-sys-color-outline);
  }
}

.sing-toolbar {
  background: var(--md-custom-color-sing-toolbar);
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-height: 64px;
  padding: 0 4px;
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
  width: 48px;
}

.volume-range-adjustment {
  margin-left: 4px;
  margin-right: 4px;
  width: 48px;
}

.sing-tempo {
  margin-left: 8px;
  margin-right: 4px;
  width: 72px;
}

.sing-tempo-icon {
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
  position: relative;
  top: 5px;
  margin-right: 8px;
  pointer-events: none;
}

.sing-playback-button {
  // primaryボタン
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-surface);
  &:before {
    box-shadow: none;
  }
  //border: 1px solid var(--md-ref-palette-neutral-variant-80);
}

.sing-playhead-position {
  align-items: center;
  display: flex;
  font-size: 28px;
  font-weight: 700;
  margin-left: 16px;
  color: var(--md-sys-color-on-surface);
}

.sing-playhead-position-millisec {
  font-size: 16px;
  font-weight: 700;
  margin: 10px 0 0 2px;
  color: var(--md-sys-color-on-surface);
}

.sing-controls {
  align-items: center;
  justify-content: flex-end;
  display: flex;
  flex: 1;
}

.sing-undo-button,
.sing-redo-button {
  height: 40px;
  min-width: 40px;
  &.disabled {
    opacity: 0.87 !important;
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
  min-width: 80px;
}
</style>
