<template>
  <QToolbar class="sing-playback-bar">
    <div class="sing-history-controls" aria-label="編集履歴">
      <button
        class="sing-history-button"
        type="button"
        :disabled="!canUndo"
        aria-label="元に戻す"
        @click="undo"
      >
        <span class="material-symbols-rounded" aria-hidden="true">undo</span>
      </button>
      <button
        class="sing-history-button"
        type="button"
        :disabled="!canRedo"
        aria-label="やり直す"
        @click="redo"
      >
        <span class="material-symbols-rounded" aria-hidden="true">redo</span>
      </button>
    </div>
    <div class="sing-playback-group">
      <button
        type="button"
        class="sing-transport-button"
        aria-label="先頭へ移動"
        @click="goToZero"
      >
        <span class="material-symbols-rounded" aria-hidden="true">
          skip_previous
        </span>
      </button>
      <button
        v-if="!nowPlaying"
        type="button"
        class="sing-playback-button sing-playback-play"
        aria-label="再生"
        @click="play"
      >
        <span class="material-symbols-rounded" aria-hidden="true">
          play_arrow
        </span>
      </button>
      <button
        v-else
        type="button"
        class="sing-playback-button sing-playback-stop"
        aria-label="停止"
        @click="stop"
      >
        <span class="material-symbols-rounded" aria-hidden="true">stop</span>
      </button>
      <button
        type="button"
        class="sing-transport-button sing-playback-loop"
        :class="{ 'sing-playback-loop-enabled': isLoopEnabled }"
        :aria-pressed="isLoopEnabled"
        aria-label="ループ"
        @click="toggleLoop"
      >
        <span class="material-symbols-rounded" aria-hidden="true">repeat</span>
      </button>
    </div>
    <div class="sing-playback-side">
      <div class="sing-playback-status">
        <PlayheadPositionDisplay class="sing-playhead-position" />
        <div class="sing-song-settings" aria-label="曲設定">
          <label class="sing-bpm-field" aria-label="テンポ">
            <input
              class="sing-bpm-input"
              type="number"
              inputmode="numeric"
              step="1"
              :value="currentBpm"
              @change="onBpmChange"
              @keydown="onBpmKeydown"
              @wheel="onBpmWheel"
            />
            <span class="sing-bpm-unit">BPM</span>
          </label>
          <div class="sing-time-signature-control" aria-label="拍子">
            <select
              class="sing-time-signature-select sing-beats-select"
              aria-label="拍子の分子"
              :value="currentTimeSignature.beats"
              @change="onBeatsChange"
            >
              <option v-for="beats in beatsOptions" :key="beats" :value="beats">
                {{ beats }}
              </option>
            </select>
            <span class="sing-beats-separator">/</span>
            <select
              class="sing-time-signature-select sing-beat-type-select"
              aria-label="拍子の分母"
              :value="currentTimeSignature.beatType"
              @change="onBeatTypeChange"
            >
              <option
                v-for="beatType in beatTypeOptions"
                :key="beatType"
                :value="beatType"
              >
                {{ beatType }}
              </option>
            </select>
          </div>
        </div>
      </div>
      <div class="sing-volume-controls">
        <span
          class="material-symbols-rounded sing-volume-icon"
          aria-hidden="true"
        >
          volume_up
        </span>
        <QSlider v-model.number="volume" trackSize="2px" class="sing-volume" />
      </div>
    </div>
  </QToolbar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import PlayheadPositionDisplay from "./PlayheadPositionDisplay.vue";
import { useStore } from "@/store";
import {
  BEAT_TYPES,
  getMeasureDuration,
  getNoteDuration,
  getTimeSignaturePositions,
  isValidBeats,
  isValidBeatType,
  isValidBpm,
} from "@/sing/music";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import { UnreachableError } from "@/type/utility";

const store = useStore();
const editor = "song";
const uiLocked = computed(() => store.getters.UI_LOCKED);
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

const nowPlaying = computed(() => store.state.nowPlaying);

const undo = () => {
  void store.actions.UNDO({ editor });
};

const redo = () => {
  void store.actions.REDO({ editor });
};

const play = () => {
  void store.actions.SING_PLAY_AUDIO();
};

const stop = () => {
  void store.actions.SING_STOP_AUDIO();
};

const goToZero = () => {
  void store.actions.SET_PLAYHEAD_POSITION({ position: 0 });
};

const tempos = computed(() => store.state.tempos);
const timeSignatures = computed(() => store.state.timeSignatures);
const tpqn = computed(() => store.state.tpqn);
const playheadTicks = computed(() => store.getters.PLAYHEAD_POSITION);

const tsPositions = computed(() => {
  return getTimeSignaturePositions(timeSignatures.value, tpqn.value);
});

const beatsOptions = computed(() => {
  return Array.from({ length: 32 }, (_, i) => i + 1);
});

const beatTypeOptions = BEAT_TYPES;

const currentTimeSignature = computed(() => {
  const maybeTimeSignature = timeSignatures.value.findLast(
    (_timeSignature, i) => tsPositions.value[i] <= playheadTicks.value,
  );
  if (!maybeTimeSignature) {
    throw new UnreachableError("assert: at least one time signature exists");
  }
  return maybeTimeSignature;
});

const setBeats = (beats: number) => {
  if (!isValidBeats(beats)) {
    return;
  }

  void store.actions.COMMAND_SET_TIME_SIGNATURE({
    timeSignature: {
      measureNumber: currentTimeSignature.value.measureNumber,
      beats,
      beatType: currentTimeSignature.value.beatType,
    },
  });
};

const setBeatType = (beatType: number) => {
  if (!isValidBeatType(beatType)) {
    return;
  }
  void store.actions.COMMAND_SET_TIME_SIGNATURE({
    timeSignature: {
      measureNumber: currentTimeSignature.value.measureNumber,
      beats: currentTimeSignature.value.beats,
      beatType,
    },
  });
};

const setBpm = (bpm: string | number | null) => {
  const bpmValue = Number(bpm);
  if (!isValidBpm(bpmValue)) {
    return;
  }
  const position = tempos.value.findLast(
    (tempo) => tempo.position <= playheadTicks.value,
  )?.position;
  if (position == undefined) {
    throw new UnreachableError("assert: at least one tempo exists");
  }
  void store.actions.COMMAND_SET_TEMPO({
    tempo: {
      position,
      bpm: bpmValue,
    },
  });
};

const currentBpm = computed(() => {
  const currentTempo = tempos.value.findLast(
    (tempo) => tempo.position <= playheadTicks.value,
  );
  if (!currentTempo) {
    throw new UnreachableError("assert: at least one tempo exists");
  }
  return currentTempo.bpm;
});

const onBpmChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) {
    return;
  }
  setBpm(event.target.value);
};

const shiftBpm = (delta: number) => {
  setBpm(currentBpm.value + delta);
};

const onBpmKeydown = (event: KeyboardEvent) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    shiftBpm(1);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    shiftBpm(-1);
  }
};

const onBpmWheel = (event: WheelEvent) => {
  event.preventDefault();
  shiftBpm(event.deltaY < 0 ? 1 : -1);
};

const onBeatsChange = (event: Event) => {
  if (!(event.target instanceof HTMLSelectElement)) {
    return;
  }
  setBeats(Number(event.target.value));
};

const onBeatTypeChange = (event: Event) => {
  if (!(event.target instanceof HTMLSelectElement)) {
    return;
  }
  setBeatType(Number(event.target.value));
};

const snapTicks = computed(() => {
  return getNoteDuration(store.state.sequencerSnapType, tpqn.value);
});

const isLoopEnabled = computed(() => store.state.isLoopEnabled);

const toggleLoop = async () => {
  if (!isLoopEnabled.value) {
    if (store.state.loopStartTick === 0 && store.state.loopEndTick === 0) {
      const playheadTsIndex = tsPositions.value.findIndex(
        (pos) => pos > playheadTicks.value,
      );
      const currentTsIndex =
        playheadTsIndex === -1
          ? tsPositions.value.length - 1
          : playheadTsIndex - 1;
      const currentTs = timeSignatures.value[currentTsIndex];

      if (!currentTs) {
        throw new Error("Could not find current time signature");
      }

      const oneMeasureTicks = getMeasureDuration(
        currentTs.beats,
        currentTs.beatType,
        tpqn.value,
      );
      const currentMeasureStartTick =
        Math.round(playheadTicks.value / snapTicks.value) * snapTicks.value;
      const currentMeasureEndTick = currentMeasureStartTick + oneMeasureTicks;

      void store.actions.SET_LOOP_RANGE({
        loopStartTick: currentMeasureStartTick,
        loopEndTick: currentMeasureEndTick,
      });
    }
  }

  void store.actions.SET_LOOP_ENABLED({
    isLoopEnabled: !isLoopEnabled.value,
  });
};

const volume = computed({
  get() {
    return store.state.volume * 100;
  },
  set(value: number) {
    void store.actions.SET_VOLUME({ volume: value / 100 });
  },
});
</script>

<style scoped lang="scss">
.sing-playback-bar {
  min-height: 64px;
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid var(--scheme-color-outline-variant);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  column-gap: 20px;
  align-items: center;
}

.sing-song-settings {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-left: 16px;
}

.sing-history-controls {
  grid-column: 1;
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 2px;
}

.sing-history-button {
  appearance: none;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--scheme-color-on-surface-variant);
  cursor: pointer;
  display: grid;
  height: 32px;
  place-items: center;
  width: 32px;

  &:hover:not(:disabled) {
    background: var(--scheme-color-surface-container-low);
  }

  &:focus-visible {
    background: var(--scheme-color-surface-container);
    box-shadow: 0 0 0 2px var(--scheme-color-primary-container);
    outline: none;
  }

  &:disabled {
    color: color-mix(
      in oklch,
      var(--scheme-color-on-surface-variant) 34%,
      transparent
    );
    cursor: default;
  }

  .material-symbols-rounded {
    display: block;
    font-size: 22px;
    font-variation-settings:
      "FILL" 1,
      "wght" 500,
      "GRAD" 0,
      "opsz" 24;
    line-height: 1;
  }
}

.sing-bpm-field {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 30px;
  padding: 0 7px;
  border-radius: 7px;
  color: var(--scheme-color-on-surface);

  &:hover,
  &:focus-within {
    background: var(--scheme-color-surface-container-low);
  }
}

.sing-bpm-input,
.sing-time-signature-select {
  appearance: none;
  background: transparent;
  border: 0;
  color: var(--scheme-color-on-surface);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  height: 26px;
  line-height: 26px;
  outline: none;
  text-align: center;
}

.sing-bpm-input {
  appearance: textfield;
  width: 31px;
  padding: 0;
}

.sing-bpm-input::-webkit-inner-spin-button,
.sing-bpm-input::-webkit-outer-spin-button {
  appearance: none;
  margin: 0;
}

.sing-bpm-input:focus {
  background: transparent;
}

.sing-bpm-unit {
  color: var(--scheme-color-outline);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  pointer-events: none;
}

.sing-time-signature-control {
  display: flex;
  align-items: center;
  gap: 0;
  height: 30px;
}

.sing-time-signature-select {
  width: 27px;
  padding: 0;
  border-radius: 7px;

  &:hover,
  &:focus {
    background: var(--scheme-color-surface-container-low);
  }
}

.sing-time-signature-select:focus {
  background: var(--scheme-color-surface-container);
}

.sing-beats-separator {
  color: var(--scheme-color-outline);
  font-size: 13px;
  font-weight: 500;
  line-height: 26px;
  pointer-events: none;
  padding: 0;
}

.sing-playback-group {
  grid-column: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.sing-playback-side {
  grid-column: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-width: 0;
}

.sing-playback-status {
  display: flex;
  align-items: center;
  min-width: 0;
}

.sing-volume-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
}

.sing-transport-button,
.sing-playback-button {
  appearance: none;
  border: 0;
  border-radius: 999px;
  background: #fff;
  color: var(--scheme-color-on-surface-variant);
  cursor: pointer;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  margin: 0;
  outline: none;
  padding: 0;

  &:hover {
    background: var(--scheme-color-surface-container-low);
  }

  &:focus-visible {
    background: var(--scheme-color-surface-container);
    box-shadow: 0 0 0 2px var(--scheme-color-primary-container);
  }

  &:active {
    background: var(--scheme-color-surface-container);
  }
}

.sing-transport-button .material-symbols-rounded,
.sing-playback-button .material-symbols-rounded {
  display: block;
  font-size: 22px;
  font-variation-settings:
    "FILL" 1,
    "wght" 500,
    "GRAD" 0,
    "opsz" 24;
  line-height: 1;
}

.sing-transport-button {
  width: 32px;
  height: 32px;
}

.sing-playback-button {
  width: 44px;
  height: 44px;
  color: var(--scheme-color-on-surface-variant);
  box-shadow: inset 0 0 0 1px
    color-mix(in oklch, var(--scheme-color-outline-variant) 52%, transparent);
}

.sing-playback-play .material-symbols-rounded,
.sing-playback-stop .material-symbols-rounded {
  transform: translateX(0.5px);
  font-size: 28px;
}

.sing-playback-loop {
  &-enabled {
    color: var(--scheme-color-primary);
    background: var(--scheme-color-secondary-container);
  }
}

.sing-playhead-position {
  margin-left: 0;
}

.sing-volume-icon {
  display: block;
  color: var(--scheme-color-on-surface-variant);
  font-size: 22px;
  font-variation-settings:
    "FILL" 1,
    "wght" 500,
    "GRAD" 0,
    "opsz" 24;
  line-height: 1;
  margin-right: 8px;
}

.sing-volume {
  width: 96px;

  :deep(.q-slider__track) {
    background-color: var(--scheme-color-surface-variant);
    color: var(--scheme-color-primary-fixed-dim);
  }

  :deep(.q-slider__thumb) {
    color: var(--scheme-color-primary-fixed-dim);
  }
}
</style>
