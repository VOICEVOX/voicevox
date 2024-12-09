<template>
  <QToolbar class="sing-toolbar">
    <!-- configs for entire song -->
    <div class="sing-configs">
      <QBtn
        class="q-mr-sm"
        :icon="isSidebarOpen ? 'menu_open' : 'menu'"
        round
        flat
        @click="toggleSidebar"
      />
      <CharacterMenuButton />
      <div class="sing-adjustment">
        <QInput
          type="number"
          dense
          :modelValue="keyRangeAdjustmentInputBuffer"
          label="音域"
          hideBottomSpace
          unelevated
          class="key-range-adjustment"
          @update:modelValue="setKeyRangeAdjustmentInputBuffer"
          @change="setKeyRangeAdjustment"
        />
        <QInput
          type="number"
          dense
          :modelValue="volumeRangeAdjustmentInputBuffer"
          label="声量"
          hideBottomSpace
          unelevated
          class="volume-range-adjustment"
          @update:modelValue="setVolumeRangeAdjustmentInputBuffer"
          @change="setVolumeRangeAdjustment"
        />
      </div>
      <QInput
        type="number"
        :modelValue="bpmInputBuffer"
        dense
        hideBottomSpace
        outlined
        unelevated
        label="テンポ"
        class="sing-tempo"
        padding="0"
        @update:modelValue="setBpmInputBuffer"
        @change="setTempo"
      />
      <QField
        hideBottomSpace
        dense
        class="sing-time-signature-field"
        label="拍子"
        stackLabel
        outlined
      >
        <template #control>
          <div class="sing-beats">
            <QSelect
              :modelValue="currentTimeSignature.beats"
              :options="beatsOptions"
              hideBottomSpace
              hideDropdownIcon
              dense
              userInputs
              unelevated
              optionsDense
              transitionShow="none"
              transitionHide="none"
              class="sing-time-signature beats"
              @update:modelValue="setBeats"
            />
            <div class="sing-beats-separator">/</div>
            <QSelect
              :modelValue="currentTimeSignature.beatType"
              :options="beatTypeOptions"
              hideBottomSpace
              hideDropdownIcon
              dense
              userInputs
              unelevated
              optionsDense
              transitionShow="none"
              transitionHide="none"
              class="sing-time-signature beat-type"
              @update:modelValue="setBeatType"
            />
          </div>
        </template>
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
        class="sing-playback-button sing-playback-play"
        icon="play_arrow"
        @click="play"
      />
      <QBtn
        v-else
        round
        class="sing-playback-button sing-playback-stop"
        icon="stop"
        @click="stop"
      />
      <PlayheadPositionDisplay class="sing-playhead-position" />
    </div>
    <!-- settings for edit controls -->
    <div class="sing-controls">
      <EditTargetSwicher :editTarget :changeEditTarget />
      <QBtn
        flat
        dense
        round
        class="sing-undo-button"
        :disable="!canUndo"
        @click="undo"
      >
        <QIcon name="undo" size="24px" />
      </QBtn>
      <QBtn
        flat
        dense
        round
        class="sing-redo-button"
        :disable="!canRedo"
        @click="redo"
      >
        <QIcon name="redo" size="24px" />
      </QBtn>
      <QIcon name="volume_up" size="xs" class="sing-volume-icon" />
      <QSlider v-model.number="volume" trackSize="2px" class="sing-volume" />
      <QSelect
        v-model="snapTypeSelectModel"
        :options="snapTypeSelectOptions"
        dense
        outlined
        hideBottomSpace
        optionsDense
        hideDropdownIcon
        unelevated
        label="スナップ"
        transitionShow="none"
        transitionHide="none"
        class="sing-snap"
      />
    </div>
  </QToolbar>
</template>

<script setup lang="ts">
import { computed, watch, ref } from "vue";
import PlayheadPositionDisplay from "../PlayheadPositionDisplay.vue";
import EditTargetSwicher from "./EditTargetSwicher.vue";
import { useStore } from "@/store";

import {
  BEAT_TYPES,
  getSnapTypes,
  getTimeSignaturePositions,
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
import { UnreachableError } from "@/type/utility";

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
  void store.actions.UNDO({ editor });
};
const redo = () => {
  void store.actions.REDO({ editor });
};

const editTarget = computed(() => store.state.sequencerEditTarget);

const changeEditTarget = (editTarget: SequencerEditTarget) => {
  void store.actions.SET_EDIT_TARGET({ editTarget });
};

const isSidebarOpen = computed(() => store.state.isSongSidebarOpen);
const toggleSidebar = () => {
  void store.actions.SET_SONG_SIDEBAR_OPEN({
    isSongSidebarOpen: !isSidebarOpen.value,
  });
};

const tempos = computed(() => store.state.tempos);
const timeSignatures = computed(() => store.state.timeSignatures);
const keyRangeAdjustment = computed(
  () => store.getters.SELECTED_TRACK.keyRangeAdjustment,
);
const volumeRangeAdjustment = computed(
  () => store.getters.SELECTED_TRACK.volumeRangeAdjustment,
);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const tpqn = computed(() => store.state.tpqn);
const playheadTicks = computed(() => store.getters.PLAYHEAD_POSITION);

const tsPositions = computed(() => {
  return getTimeSignaturePositions(timeSignatures.value, tpqn.value);
});

const beatsOptions = computed(() => {
  return Array.from({ length: 32 }, (_, i) => ({
    label: (i + 1).toString(),
    value: i + 1,
  }));
});

const beatTypeOptions = BEAT_TYPES.map((beatType) => ({
  label: beatType.toString(),
  value: beatType,
}));

const bpmInputBuffer = ref(120);
const keyRangeAdjustmentInputBuffer = ref(0);
const volumeRangeAdjustmentInputBuffer = ref(0);

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

const currentTimeSignature = computed(() => {
  const maybeTimeSignature = timeSignatures.value.findLast(
    (_timeSignature, i) => tsPositions.value[i] <= playheadTicks.value,
  );
  if (!maybeTimeSignature) {
    throw new UnreachableError("assert: at least one time signature exists");
  }
  return maybeTimeSignature;
});

const setBeats = (beats: { label: string; value: number }) => {
  if (!isValidBeats(beats.value)) {
    return;
  }

  void store.actions.COMMAND_SET_TIME_SIGNATURE({
    timeSignature: {
      measureNumber: currentTimeSignature.value.measureNumber,
      beats: beats.value,
      beatType: currentTimeSignature.value.beatType,
    },
  });
};

const setBeatType = (beatType: { label: string; value: number }) => {
  if (!isValidBeatType(beatType.value)) {
    return;
  }
  void store.actions.COMMAND_SET_TIME_SIGNATURE({
    timeSignature: {
      measureNumber: currentTimeSignature.value.measureNumber,
      beats: currentTimeSignature.value.beats,
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
  if (!isValidVolumeRangeAdjustment(volumeRangeAdjustmentValue)) {
    return;
  }
  volumeRangeAdjustmentInputBuffer.value = volumeRangeAdjustmentValue;
};

const setTempo = () => {
  const bpm = bpmInputBuffer.value;
  const position = tempos.value.findLast(
    (tempo) => tempo.position <= playheadTicks.value,
  )?.position;
  if (position == undefined) {
    throw new UnreachableError("assert: at least one tempo exists");
  }
  void store.actions.COMMAND_SET_TEMPO({
    tempo: {
      position,
      bpm,
    },
  });
};

const setKeyRangeAdjustment = () => {
  const keyRangeAdjustment = keyRangeAdjustmentInputBuffer.value;
  void store.actions.COMMAND_SET_KEY_RANGE_ADJUSTMENT({
    keyRangeAdjustment,
    trackId: selectedTrackId.value,
  });
};

const setVolumeRangeAdjustment = () => {
  const volumeRangeAdjustment = volumeRangeAdjustmentInputBuffer.value;
  void store.actions.COMMAND_SET_VOLUME_RANGE_ADJUSTMENT({
    volumeRangeAdjustment,
    trackId: selectedTrackId.value,
  });
};

watch(
  [tempos, playheadTicks],
  () => {
    const currentTempo = tempos.value.findLast(
      (tempo) => tempo.position <= playheadTicks.value,
    );
    if (!currentTempo) {
      throw new UnreachableError("assert: at least one tempo exists");
    }
    bpmInputBuffer.value = currentTempo.bpm;
  },
  { immediate: true },
);

const nowPlaying = computed(() => store.state.nowPlaying);

const play = () => {
  void store.actions.SING_PLAY_AUDIO();
};

const stop = () => {
  void store.actions.SING_STOP_AUDIO();
};

const goToZero = () => {
  void store.actions.SET_PLAYHEAD_POSITION({ position: 0 });
};

const volume = computed({
  get() {
    return store.state.volume * 100;
  },
  set(value: number) {
    void store.actions.SET_VOLUME({ volume: value / 100 });
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
    void store.actions.SET_SNAP_TYPE({
      snapType: value.snapType,
    });
  },
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/colors" as colors;

// テキストフィールドのデフォルト
:deep(.q-field__native) {
  color: var(--scheme-color-on-surface);
  text-align: center;
  font-size: 14px;
  font-weight: 400;
}

/* QInput のアウトラインをoutline-variantにする */
:deep(.q-input .q-field__control:before, .q-select .q-field__control:before) {
  border: 1px solid var(--scheme-color-outline-variant);
}

:deep(.q-field--outlined .q-field__control) {
  padding-right: 8px;
  padding-left: 8px;
}

// ラベルのフォントサイズを小さくする()
:deep(.q-input .q-field__label, .q-select .q-field__label) {
  font-size: 12px;
  color: var(--scheme-color-on-surface-variant);
}

// 数字入力のテキストフィールド
:deep(.q-field__native[type="number"]) {
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    cursor: pointer;
  }

  // スピンボタンのホバー状態
  &:hover::-webkit-inner-spin-button,
  &:hover::-webkit-outer-spin-button {
    background: var(--scheme-color-surface-container-highest);
  }

  // スピンボタンのアクティブ状態
  &:active::-webkit-inner-spin-button,
  &:active::-webkit-outer-spin-button {
    background: var(--scheme-color-surface-container-low);
  }
}

:deep(
    .q-input .q-field__control:hover:before,
    .q-select .q-field__control:hover:before
  ) {
  border: 1px solid var(--scheme-color-outline);
}

// オプションメニュー全体の背景色
:deep(.q-menu) {
  background: var(--scheme-color-surface-container);
}

// TODO: アクティブ色が効かないので修正したい
:deep(.q-menu .q-item--active) {
  //background-color: var(--scheme-color-secondary-container);
  color: var(--scheme-color-primary);
}

.sing-toolbar {
  background: var(--scheme-color-sing-toolbar-container);
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-height: 64px;
  padding: 8px 12px 8px 8px;
  width: 100%;
  letter-spacing: 0.01em;
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

.sing-adjustment {
  height: 40px;
  border: 1px solid var(--scheme-color-outline-variant);
  border-left: 0;
  border-radius: 0 4px 4px 0;
  padding: 0 0 0 8px;
  display: flex;
  align-items: center;
}

.key-range-adjustment {
  margin-right: 0px;
  width: 40px;

  :deep(.q-field__control) {
    height: 40px;

    &:before {
      border: 1px solid transparent;
    }

    &:hover:before {
      border-color: transparent;
      border-bottom: 1px solid var(--scheme-color-outline);
    }
  }
}

.volume-range-adjustment {
  width: 40px;

  :deep(.q-field__control) {
    padding: 0 2px;
    height: 40px;

    &:before {
      border: 1px solid transparent;
    }

    &:hover:before {
      border-color: transparent;
      border-bottom: 1px solid var(--scheme-color-outline);
    }
  }
}

.sing-tempo {
  margin-left: 16px;
  margin-right: 4px;
  width: 60px;
}

.sing-time-signature-field {
  height: 40px;

  :deep(.q-field__control) {
    height: 40px;
    padding: 0 2px;
  }

  :deep(.q-field__label) {
    font-size: 9px;
    top: 5.5px;
    margin-left: 6px;
    transform: translateY(0) !important;
    color: var(--scheme-color-on-surface-variant);
    opacity: 0.9;
  }

  :deep(.q-field__native) {
    padding-top: 4px;
  }

  :deep(.q-field__control:before) {
    border-color: var(--scheme-color-outline-variant);
  }

  :deep(.q-field__control:hover:before) {
    border-color: var(--scheme-color-outline);
  }
}

.sing-time-signature.beats {
  :deep(.q-field__control) {
    padding: 0 4px 0 8px;
  }
}

.sing-time-signature.beat-type {
  :deep(.q-field__control) {
    padding: 0 8px 0 4px;
  }
}

.sing-beats {
  display: flex;
  align-items: center;
  height: 40px;
  margin-top: -14px;

  &:deep(.q-field__control:before) {
    border: 1px solid transparent;
  }

  &:deep(.q-field__control) {
    background: transparent;
    padding: 0 4px;
  }

  &:deep(.q-field__control:hover:before) {
    border-color: transparent;
  }
}

.sing-beats-separator {
  font-weight: 400;
  color: var(--scheme-color-outline);
  pointer-events: none;
  transform: translateY(6px);
}

.sing-transport-button {
  color: var(--scheme-color-on-surface-variant);
  margin-right: 0.25rem;
}

.sing-playback-button {
  background: var(--scheme-color-sing-playback-button-container);
  color: var(--scheme-color-sing-on-playback-button-container);
  &:before {
    box-shadow: none;
  }

  &.sing-playback-play .q-btn__wrapper .q-icon {
    transform: translateX(-0.5px);
  }

  &.sing-playback-stop .q-btn__wrapper .q-icon {
    transform: translateX(-0.5px);
  }
}

.sing-playhead-position {
  margin-left: 16px;
}

.sing-controls {
  align-items: center;
  justify-content: flex-end;
  display: flex;
  flex: 1;
}

.sing-undo-button {
  margin-left: 24px;
}

.sing-undo-button,
.sing-redo-button {
  color: var(--scheme-color-on-surface-variant);
  width: 40px;
  height: 40px;
  &.disabled {
    opacity: 0.38 !important;
  }
}
.sing-redo-button {
  margin-right: 8px;
}

.sing-volume-icon {
  margin-right: 8px;

  :deep() {
    color: var(--scheme-color-outline);
  }
}

.sing-volume {
  margin-right: 16px;
  width: 72px;

  :deep(.q-slider__track) {
    background-color: var(--scheme-color-surface-variant);
    color: var(--scheme-color-primary-fixed-dim);
  }

  :deep(.q-slider__thumb) {
    color: var(--scheme-color-primary-fixed-dim);
  }
}

.sing-snap {
  min-width: 64px;
  height: 40px;

  &:deep(.q-field__control:before) {
    height: 40px;
    border: 1px solid var(--scheme-color-outline-variant);
  }

  :deep(.q-field__control:hover:before) {
    border-color: var(--scheme-color-outline);
  }

  :deep(.q-field__label) {
    font-size: 12px;
    color: var(--scheme-color-on-surface-variant);
  }
}
</style>
