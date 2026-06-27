<template>
  <QToolbar class="sing-toolbar">
    <div class="sing-track-lane">
      <QBtn
        class="sing-sidebar-button"
        :icon="isSidebarOpen ? 'menu_open' : 'menu'"
        round
        flat
        @click="toggleSidebar"
      />
      <div class="sing-track-strip">
        <div class="sing-track-header">
          <CharacterMenuButton />
          <button class="sing-track-parameter-summary" type="button">
            <span class="sing-track-parameter-line">
              <span class="sing-track-parameter-label">歌い方</span>
              <span class="sing-track-parameter-value">{{
                singingTeacherLabel
              }}</span>
            </span>
            <span class="sing-track-parameter-line compact">
              <span class="sing-track-parameter-pair">
                <span class="sing-track-parameter-label">音域</span>
                <span class="sing-track-parameter-value">{{
                  keyRangeAdjustment
                }}</span>
              </span>
              <span class="sing-track-parameter-pair">
                <span class="sing-track-parameter-label">声量</span>
                <span class="sing-track-parameter-value">{{
                  volumeRangeAdjustment
                }}</span>
              </span>
            </span>
            <QMenu class="sing-track-parameter-menu" anchor="bottom left">
              <div class="sing-track-parameter-menu-content" @click.stop>
                <label class="sing-track-parameter-menu-row">
                  <span>歌い方</span>
                  <select
                    class="sing-track-parameter-menu-control"
                    :value="singingTeacherLabel"
                    @change="setSingingTeacher"
                  >
                    <option
                      v-for="option in singingTeacherOptions"
                      :key="option"
                      :value="option"
                    >
                      {{ option }}
                    </option>
                  </select>
                </label>
                <label class="sing-track-parameter-menu-row">
                  <span>音域</span>
                  <input
                    class="sing-track-parameter-menu-control number"
                    type="number"
                    :value="keyRangeAdjustment"
                    @change="setKeyRangeAdjustment"
                  />
                </label>
                <label class="sing-track-parameter-menu-row">
                  <span>声量</span>
                  <input
                    class="sing-track-parameter-menu-control number"
                    type="number"
                    :value="volumeRangeAdjustment"
                    @change="setVolumeRangeAdjustment"
                  />
                </label>
              </div>
            </QMenu>
          </button>
        </div>
        <div class="sing-singer-map">
          <div class="sing-minimap-layout" @wheel="onMinimapWheel">
            <div ref="minimapViewportRef" class="sing-minimap-viewport">
              <button
                class="sing-minimap-content"
                type="button"
                aria-label="ノートミニマップの位置へ移動"
                :style="{
                  width: minimapContentWidthStyle,
                  transform: minimapContentTransform,
                }"
                @click="setPlayheadFromMinimap"
              >
                <div class="sing-minimap-grid"></div>
                <div
                  class="sing-minimap-playhead"
                  :style="{ left: `${minimapPlayheadPosition}%` }"
                ></div>
                <div
                  v-for="phraseLyric in minimapPhraseLyrics"
                  :key="phraseLyric.id"
                  class="sing-minimap-phrase-lyric"
                  :style="{
                    left: `${phraseLyric.left}%`,
                    width: `${phraseLyric.width}%`,
                  }"
                >
                  <span>{{ phraseLyric.text }}</span>
                </div>
                <div
                  v-for="previewNote in minimapNotes"
                  :key="previewNote.id"
                  class="sing-minimap-note"
                  :style="{
                    left: `${previewNote.left}%`,
                    width: `${previewNote.width}%`,
                    top: `${previewNote.top}%`,
                  }"
                ></div>
              </button>
            </div>
            <div class="sing-minimap-controls">
              <div
                ref="minimapScrollbarRef"
                class="sing-minimap-scrollbar-shell"
                :class="{ dragging: isMinimapScrollbarDragging }"
                role="slider"
                tabindex="0"
                aria-label="ミニマップのスクロール"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="Math.round(minimapScrollRatio * 100)"
                @pointerdown="onMinimapScrollbarPointerDown"
                @keydown.left.prevent="scrollMinimapByKeyboard(-1)"
                @keydown.right.prevent="scrollMinimapByKeyboard(1)"
                @keydown.home.prevent="scrollMinimapToEdge(0)"
                @keydown.end.prevent="scrollMinimapToEdge(1)"
              >
                <div class="sing-minimap-scrollbar-rail" aria-hidden="true">
                  <div
                    v-for="marker in minimapScrollbarMarkers"
                    :key="marker.id"
                    class="sing-minimap-scrollbar-marker"
                    :class="{ error: marker.isError }"
                    :style="{
                      left: `${marker.left}%`,
                      width: `${marker.width}%`,
                      opacity: marker.opacity,
                    }"
                  ></div>
                  <div
                    class="sing-minimap-scrollbar-window"
                    :style="{
                      left: `${minimapVisibleRange.left}%`,
                      width: `${minimapVisibleRange.width}%`,
                    }"
                  ></div>
                </div>
              </div>
              <div class="sing-minimap-zoom" @click.stop>
                <button
                  class="sing-minimap-zoom-button"
                  type="button"
                  aria-label="ミニマップを縮小"
                  @click="decreaseMinimapZoom"
                >
                  -
                </button>
                <input
                  v-model.number="minimapZoom"
                  class="sing-minimap-zoom-slider"
                  type="range"
                  :min="MINIMAP_ZOOM_MIN"
                  :max="MINIMAP_ZOOM_MAX"
                  :step="MINIMAP_ZOOM_STEP"
                  aria-label="ミニマップのズーム"
                />
                <button
                  class="sing-minimap-zoom-button"
                  type="button"
                  aria-label="ミニマップを拡大"
                  @click="increaseMinimapZoom"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </QToolbar>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useStore } from "@/store";
import {
  getEndTicksOfPhrase,
  getDefaultLyric,
  getStartTicksOfPhrase,
  isValidKeyRangeAdjustment,
  isValidVolumeRangeAdjustment,
} from "@/sing/domain";
import { getTimeSignaturePositions, tickToMeasureNumber } from "@/sing/music";
import { getTotalTicks } from "@/sing/rulerHelper";
import { SEQUENCER_MIN_NUM_MEASURES } from "@/sing/viewHelper";
import CharacterMenuButton from "@/components/Sing/CharacterMenuButton/MenuButton.vue";
import type { Note } from "@/domain/project/type";

const store = useStore();
const MINIMAP_QUARTER_NOTE_WIDTH = 12;
const MINIMAP_NOTE_LOW_NOTE_NUMBER = 48;
const MINIMAP_NOTE_HIGH_NOTE_NUMBER = 84;
const MINIMAP_NOTE_TOP_OFFSET = 48;
const MINIMAP_NOTE_VERTICAL_RANGE = 28;
const MINIMAP_ZOOM_MIN = 0.05;
const MINIMAP_ZOOM_MAX = 3;
const MINIMAP_ZOOM_STEP = 0.05;

const isSidebarOpen = computed(() => store.state.isSongSidebarOpen);
const toggleSidebar = () => {
  void store.actions.SET_SONG_SIDEBAR_OPEN({
    isSongSidebarOpen: !isSidebarOpen.value,
  });
};

const keyRangeAdjustment = computed(
  () => store.getters.SELECTED_TRACK.keyRangeAdjustment,
);
const volumeRangeAdjustment = computed(
  () => store.getters.SELECTED_TRACK.volumeRangeAdjustment,
);
const selectedTrack = computed(() => store.getters.SELECTED_TRACK);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const singingTeacherLabel = ref("波音リツ");
const singingTeacherOptions = ["波音リツ", "ずんだもん", "四国めたん"];
const minimapZoom = ref(1);
const minimapViewportRef = ref<HTMLElement>();
const minimapScrollbarRef = ref<HTMLElement>();
const minimapViewportWidth = ref(0);
const minimapScrollLeft = ref(0);
const isMinimapScrollbarDragging = ref(false);
let minimapResizeObserver: ResizeObserver | undefined;

const setSingingTeacher = (event: Event) => {
  singingTeacherLabel.value = (event.target as HTMLSelectElement).value;
};

const arrangementEndTick = computed(() => {
  const tpqn = Math.max(store.state.tpqn, 1);
  const timeSignatures = store.state.timeSignatures;
  if (timeSignatures.length === 0) {
    const selectedTrackNoteEnds = selectedTrack.value.notes.map(
      (note) => note.position + note.duration,
    );
    return Math.max(...selectedTrackNoteEnds, 1);
  }

  const noteEndPositions = [...store.state.tracks.values()].flatMap((track) =>
    track.notes.map((note) => note.position + note.duration),
  );
  const timeSignaturePositions = getTimeSignaturePositions(
    timeSignatures,
    tpqn,
  );
  const lastTimeSignaturePosition = timeSignaturePositions.at(-1) ?? 0;
  const lastTempoPosition = store.state.tempos.at(-1)?.position ?? 0;
  const maxTick = Math.max(
    lastTimeSignaturePosition,
    lastTempoPosition,
    ...noteEndPositions,
    0,
  );
  const numMeasures = Math.max(
    SEQUENCER_MIN_NUM_MEASURES,
    tickToMeasureNumber(maxTick, timeSignatures, tpqn) + 8,
  );

  return Math.max(getTotalTicks(timeSignatures, numMeasures, tpqn), 1);
});
const selectedTrackPhrases = computed(() => {
  return [...store.state.phrases.entries()]
    .filter(
      ([, phrase]) =>
        phrase.trackId === selectedTrackId.value && phrase.notes.length > 0,
    )
    .sort(
      ([, a], [, b]) => getStartTicksOfPhrase(a) - getStartTicksOfPhrase(b),
    );
});
const overlappingNoteIds = computed(() =>
  store.getters.OVERLAPPING_NOTE_IDS(selectedTrackId.value),
);
const clampPercent = (value: number) => Math.max(0, Math.min(value, 100));
const toPercent = (value: number, start: number, end: number) => {
  const span = Math.max(end - start, 1);
  return clampPercent(((value - start) / span) * 100);
};
const getRatioFromPointerEvent = (event: MouseEvent) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return Math.max(0, Math.min((event.clientX - rect.left) / rect.width, 1));
};
const setPlayheadFromRange = (
  event: MouseEvent,
  start: number,
  end: number,
) => {
  const ratio = getRatioFromPointerEvent(event);
  const position = Math.round(start + (end - start) * ratio);
  void store.actions.SET_PLAYHEAD_POSITION({ position });
};
const setPlayheadFromMinimap = (event: MouseEvent) => {
  setPlayheadFromRange(event, 0, arrangementEndTick.value);
};
const minimapPlayheadPosition = computed(() =>
  toPercent(store.getters.PLAYHEAD_POSITION, 0, arrangementEndTick.value),
);
const minimapContentWidth = computed(() => {
  const tpqn = Math.max(store.state.tpqn, 1);
  const quarterNotes = arrangementEndTick.value / tpqn;
  const contentWidth =
    quarterNotes * MINIMAP_QUARTER_NOTE_WIDTH * minimapZoom.value;
  return Math.max(minimapViewportWidth.value, Math.ceil(contentWidth));
});
const minimapContentWidthStyle = computed(
  () => `${minimapContentWidth.value}px`,
);
const minimapScrollMax = computed(() =>
  Math.max(minimapContentWidth.value - minimapViewportWidth.value, 0),
);
const minimapScrollRatio = computed({
  get: () =>
    minimapScrollMax.value === 0
      ? 0
      : minimapScrollLeft.value / minimapScrollMax.value,
  set: (value) => {
    minimapScrollLeft.value =
      Math.max(0, Math.min(Number(value), 1)) * minimapScrollMax.value;
  },
});
const minimapContentTransform = computed(
  () => `translateX(-${minimapScrollLeft.value}px)`,
);
const minimapVisibleRange = computed(() => {
  const contentWidth = Math.max(minimapContentWidth.value, 1);
  return {
    left: clampPercent((minimapScrollLeft.value / contentWidth) * 100),
    width: clampPercent((minimapViewportWidth.value / contentWidth) * 100),
  };
});
const clampMinimapZoom = (value: number) =>
  Math.max(MINIMAP_ZOOM_MIN, Math.min(value, MINIMAP_ZOOM_MAX));
const increaseMinimapZoom = () => {
  minimapZoom.value = clampMinimapZoom(
    Number((minimapZoom.value + MINIMAP_ZOOM_STEP).toFixed(2)),
  );
};
const decreaseMinimapZoom = () => {
  minimapZoom.value = clampMinimapZoom(
    Number((minimapZoom.value - MINIMAP_ZOOM_STEP).toFixed(2)),
  );
};
const updateMinimapViewportWidth = () => {
  minimapViewportWidth.value = minimapViewportRef.value?.clientWidth ?? 0;
};
const setMinimapScrollLeft = (value: number) => {
  minimapScrollLeft.value = Math.max(
    0,
    Math.min(value, minimapScrollMax.value),
  );
};
const setMinimapScrollFromClientX = (clientX: number) => {
  const railElement = minimapScrollbarRef.value?.querySelector<HTMLElement>(
    ".sing-minimap-scrollbar-rail",
  );
  if (railElement == undefined || minimapScrollMax.value === 0) return;

  const rect = railElement.getBoundingClientRect();
  const contentWidth = Math.max(minimapContentWidth.value, 1);
  const visibleRatio = Math.min(minimapViewportWidth.value / contentWidth, 1);
  const pointerRatio = Math.max(
    0,
    Math.min((clientX - rect.left) / rect.width, 1),
  );
  const leftRatio = Math.max(
    0,
    Math.min(pointerRatio - visibleRatio / 2, 1 - visibleRatio),
  );
  setMinimapScrollLeft(leftRatio * contentWidth);
};
const onMinimapScrollbarPointerMove = (event: PointerEvent) => {
  event.preventDefault();
  setMinimapScrollFromClientX(event.clientX);
};
const stopMinimapScrollbarDrag = () => {
  isMinimapScrollbarDragging.value = false;
  window.removeEventListener("pointermove", onMinimapScrollbarPointerMove);
  window.removeEventListener("pointerup", stopMinimapScrollbarDrag);
  window.removeEventListener("pointercancel", stopMinimapScrollbarDrag);
};
const onMinimapScrollbarPointerDown = (event: PointerEvent) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (minimapScrollMax.value === 0) return;

  event.preventDefault();
  isMinimapScrollbarDragging.value = true;
  setMinimapScrollFromClientX(event.clientX);
  window.addEventListener("pointermove", onMinimapScrollbarPointerMove);
  window.addEventListener("pointerup", stopMinimapScrollbarDrag);
  window.addEventListener("pointercancel", stopMinimapScrollbarDrag);
};
const scrollMinimapByKeyboard = (direction: -1 | 1) => {
  setMinimapScrollLeft(
    minimapScrollLeft.value + direction * minimapViewportWidth.value * 0.16,
  );
};
const scrollMinimapToEdge = (ratio: 0 | 1) => {
  setMinimapScrollLeft(minimapScrollMax.value * ratio);
};
const getWheelDeltaUnit = (event: WheelEvent) => {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return Math.max(minimapViewportWidth.value, 1);
  }
  return 1;
};
const onMinimapWheel = (event: WheelEvent) => {
  if (minimapScrollMax.value === 0) return;

  const wheelDelta =
    Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
  if (wheelDelta === 0) return;

  event.preventDefault();
  setMinimapScrollLeft(
    minimapScrollLeft.value + wheelDelta * getWheelDeltaUnit(event),
  );
};

onMounted(() => {
  void nextTick(() => {
    updateMinimapViewportWidth();
    if (minimapViewportRef.value != undefined) {
      minimapResizeObserver = new ResizeObserver(updateMinimapViewportWidth);
      minimapResizeObserver.observe(minimapViewportRef.value);
    }
  });
});

onBeforeUnmount(() => {
  minimapResizeObserver?.disconnect();
  stopMinimapScrollbarDrag();
});

watch(minimapScrollMax, () => {
  setMinimapScrollLeft(minimapScrollLeft.value);
});
const getLyricForNote = (note: Note) => {
  const explicitLyric = note.lyric?.trim();
  return explicitLyric && explicitLyric.length > 0
    ? explicitLyric
    : getDefaultLyric(note.noteNumber, store.state.defaultLyricMode);
};
const createNoteScrollbarMarker = (
  note: Note,
  idPrefix: string,
  isError = false,
) => ({
  id: `${idPrefix}:${note.id}`,
  left: toPercent(note.position, 0, arrangementEndTick.value),
  width: Math.max(
    toPercent(note.position + note.duration, 0, arrangementEndTick.value) -
      toPercent(note.position, 0, arrangementEndTick.value),
    0.35,
  ),
  opacity: isError ? 1 : 0.64,
  isError,
});
const minimapScrollbarMarkers = computed(() => {
  const noteErrorMarkers = selectedTrack.value.notes
    .filter((note) => overlappingNoteIds.value.has(note.id))
    .map((note) => createNoteScrollbarMarker(note, "error-note", true));

  if (selectedTrackPhrases.value.length === 0) {
    return [
      ...selectedTrack.value.notes.map((note) =>
        createNoteScrollbarMarker(note, "note"),
      ),
      ...noteErrorMarkers,
    ];
  }

  const phraseMarkers = selectedTrackPhrases.value.map(
    ([phraseKey, phrase]) => {
      const startTicks = getStartTicksOfPhrase(phrase);
      const endTicks = getEndTicksOfPhrase(phrase);
      return {
        id: `phrase:${phraseKey}`,
        left: toPercent(startTicks, 0, arrangementEndTick.value),
        width: Math.max(
          toPercent(endTicks, 0, arrangementEndTick.value) -
            toPercent(startTicks, 0, arrangementEndTick.value),
          0.35,
        ),
        opacity: Math.min(0.46 + phrase.notes.length * 0.045, 0.78),
        isError: false,
      };
    },
  );

  const phraseErrorMarkers = selectedTrackPhrases.value
    .filter(([, phrase]) => phrase.state === "COULD_NOT_RENDER")
    .map(([phraseKey, phrase]) => {
      const startTicks = getStartTicksOfPhrase(phrase);
      const endTicks = getEndTicksOfPhrase(phrase);
      return {
        id: `error-phrase:${phraseKey}`,
        left: toPercent(startTicks, 0, arrangementEndTick.value),
        width: Math.max(
          toPercent(endTicks, 0, arrangementEndTick.value) -
            toPercent(startTicks, 0, arrangementEndTick.value),
          0.35,
        ),
        opacity: 1,
        isError: true,
      };
    });

  return [...phraseMarkers, ...phraseErrorMarkers, ...noteErrorMarkers];
});
const minimapPhraseLyrics = computed(() => {
  if (selectedTrackPhrases.value.length > 0) {
    return selectedTrackPhrases.value.map(([phraseKey, phrase]) => {
      const startTicks = getStartTicksOfPhrase(phrase);
      const endTicks = getEndTicksOfPhrase(phrase);
      return {
        id: String(phraseKey),
        left: toPercent(startTicks, 0, arrangementEndTick.value),
        width: Math.max(
          toPercent(endTicks, 0, arrangementEndTick.value) -
            toPercent(startTicks, 0, arrangementEndTick.value),
          0.8,
        ),
        text: phrase.notes.map(getLyricForNote).join(""),
      };
    });
  }

  const notes = selectedTrack.value.notes;
  if (notes.length === 0) return [];

  const startTicks = Math.min(...notes.map((note) => note.position));
  const endTicks = Math.max(
    ...notes.map((note) => note.position + note.duration),
  );
  return [
    {
      id: "track",
      left: toPercent(startTicks, 0, arrangementEndTick.value),
      width: Math.max(
        toPercent(endTicks, 0, arrangementEndTick.value) -
          toPercent(startTicks, 0, arrangementEndTick.value),
        0.8,
      ),
      text: notes.map(getLyricForNote).join(""),
    },
  ];
});
const minimapNotes = computed(() => {
  const notes = selectedTrack.value.notes;
  if (notes.length === 0) return [];

  const noteNumberRange =
    MINIMAP_NOTE_HIGH_NOTE_NUMBER - MINIMAP_NOTE_LOW_NOTE_NUMBER;

  return notes.map((note) => {
    const noteNumber = Math.max(
      MINIMAP_NOTE_LOW_NOTE_NUMBER,
      Math.min(note.noteNumber, MINIMAP_NOTE_HIGH_NOTE_NUMBER),
    );
    return {
      id: note.id,
      left: toPercent(note.position, 0, arrangementEndTick.value),
      width: Math.max(
        toPercent(note.position + note.duration, 0, arrangementEndTick.value) -
          toPercent(note.position, 0, arrangementEndTick.value),
        0.6,
      ),
      top:
        MINIMAP_NOTE_TOP_OFFSET +
        ((MINIMAP_NOTE_HIGH_NOTE_NUMBER - noteNumber) / noteNumberRange) *
          MINIMAP_NOTE_VERTICAL_RANGE,
    };
  });
});

const setKeyRangeAdjustment = (event: Event) => {
  const keyRangeAdjustmentValue = Number(
    (event.target as HTMLInputElement).value,
  );
  if (!isValidKeyRangeAdjustment(keyRangeAdjustmentValue)) {
    return;
  }
  void store.actions.COMMAND_SET_KEY_RANGE_ADJUSTMENT({
    keyRangeAdjustment: keyRangeAdjustmentValue,
    trackId: selectedTrackId.value,
  });
};

const setVolumeRangeAdjustment = (event: Event) => {
  const volumeRangeAdjustmentValue = Number(
    (event.target as HTMLInputElement).value,
  );
  if (!isValidVolumeRangeAdjustment(volumeRangeAdjustmentValue)) {
    return;
  }
  void store.actions.COMMAND_SET_VOLUME_RANGE_ADJUSTMENT({
    volumeRangeAdjustment: volumeRangeAdjustmentValue,
    trackId: selectedTrackId.value,
  });
};
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
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container) 42%,
    var(--scheme-color-surface-container-highest)
  );
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-height: 80px;
  padding: 8px 14px 8px 8px;
  width: 100%;
  border-bottom: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 54%, transparent);
  letter-spacing: 0.01em;
}

.sing-track-lane {
  align-items: center;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 6px;
  width: 100%;
}

.sing-sidebar-button {
  color: var(--scheme-color-on-surface-variant);
}

.sing-track-strip {
  display: flex;
  align-items: stretch;
  min-width: 0;
  height: 64px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 38%, transparent);
  border-radius: 6px;
  background: var(--scheme-color-surface-container-highest);
  overflow: hidden;
}

.sing-track-header {
  display: flex;
  align-items: stretch;
  flex: 0 0 auto;
  min-width: 0;
  padding: 0;
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 34%, transparent);
  background: var(--scheme-color-surface-container-highest);
}

.sing-track-header :deep(.q-btn) {
  height: 100%;
  min-width: 0;
  max-width: 156px;
  border-radius: 0;
}

.sing-track-header :deep(.q-btn__content) {
  height: 100%;
  min-width: 0;
  justify-content: flex-start;
}

.sing-track-parameter-summary {
  appearance: none;
  align-self: stretch;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--scheme-color-on-surface);
  display: flex;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
  height: 100%;
  margin-left: 0;
  min-width: 0;
  padding: 4px 7px 4px 10px;
  width: 112px;
  border-left: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 38%, transparent);
  font: inherit;
  text-align: left;

  &:hover {
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container) 72%,
      transparent
    );
  }
}

.sing-track-parameter-line {
  align-items: baseline;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  min-width: 0;

  &.compact {
    grid-template-columns: max-content max-content;
    column-gap: 6px;
  }
}

.sing-track-parameter-pair {
  align-items: baseline;
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr);
  min-width: 0;
}

.sing-track-parameter-label {
  color: var(--scheme-color-on-surface-variant);
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
  white-space: nowrap;
}

.sing-track-parameter-value {
  color: var(--scheme-color-on-surface);
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.sing-track-parameter-menu) {
  border-radius: 8px;
  box-shadow: 0 10px 28px
    color-mix(in oklch, var(--scheme-color-shadow) 14%, transparent);
}

:global(.sing-track-parameter-menu-content) {
  display: grid;
  gap: 8px;
  min-width: 196px;
  padding: 12px;
}

:global(.sing-track-parameter-menu-row) {
  align-items: baseline;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 18px;
  color: var(--scheme-color-on-surface-variant);
  font-size: 12px;
  line-height: 18px;
}

:global(.sing-track-parameter-menu-control) {
  appearance: none;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 68%, transparent);
  border-radius: 5px;
  background: var(--scheme-color-surface-container-highest);
  color: var(--scheme-color-on-surface);
  font: inherit;
  font-weight: 500;
  min-width: 0;
  padding: 4px 8px;
  width: 100%;

  &:focus {
    border-color: color-mix(
      in oklch,
      var(--scheme-color-outline) 72%,
      transparent
    );
    outline: none;
  }

  &.number {
    appearance: textfield;
    text-align: right;
  }
}

.sing-singer-map {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  padding: 0;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-low) 62%,
    var(--scheme-color-surface-container-high)
  );
  overflow: hidden;
}

.sing-minimap-layout {
  display: grid;
  grid-template-rows: minmax(0, 1fr) 18px;
  height: 100%;
  min-width: 0;
  background:
    linear-gradient(
      180deg,
      transparent 0,
      transparent 49%,
      color-mix(in oklch, var(--scheme-color-outline-variant) 28%, transparent)
        50%,
      transparent 51%,
      transparent 100%
    ),
    color-mix(
      in oklch,
      var(--scheme-color-surface-container-highest) 68%,
      var(--scheme-color-surface-container)
    );
}

.sing-minimap-viewport {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.sing-minimap-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 136px;
  align-items: center;
  min-width: 0;
}

.sing-minimap-scrollbar-shell {
  position: relative;
  height: 18px;
  min-width: 0;
  padding: 0 6px;
  cursor: grab;
  outline: none;

  &.dragging {
    cursor: grabbing;
  }

  &:focus-visible .sing-minimap-scrollbar-rail {
    box-shadow: 0 0 0 1px
      color-mix(in oklch, var(--scheme-color-primary) 36%, transparent);
  }
}

.sing-minimap-scrollbar-rail {
  position: absolute;
  right: 6px;
  left: 6px;
  top: 3px;
  height: 12px;
  border-radius: 6px;
  background: color-mix(
    in oklch,
    var(--scheme-color-on-surface-variant) 10%,
    transparent
  );
  overflow: hidden;
  pointer-events: none;
}

.sing-minimap-scrollbar-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  min-width: 2px;
  border-radius: 1px;
  background: color-mix(
    in oklch,
    var(--scheme-color-on-surface-variant) 70%,
    transparent
  );

  &.error {
    z-index: 4;
    min-width: 3px;
    background: color-mix(in oklch, var(--scheme-color-error) 90%, transparent);
    opacity: 1 !important;
  }
}

.sing-minimap-scrollbar-window {
  position: absolute;
  top: 3px;
  bottom: 3px;
  z-index: 2;
  min-width: 18px;
  border-radius: 999px;
  background: color-mix(
    in oklch,
    var(--scheme-color-on-surface-variant) 20%,
    transparent
  );
  box-shadow: inset 0 0 0 1px
    color-mix(in oklch, var(--scheme-color-on-surface-variant) 14%, transparent);
}

.sing-minimap-zoom {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 18px;
  gap: 4px;
  align-items: center;
  height: 18px;
  padding: 0 7px;
}

.sing-minimap-zoom-button {
  appearance: none;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--scheme-color-on-surface-variant);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;

  &:hover {
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container-highest) 72%,
      transparent
    );
    color: var(--scheme-color-on-surface);
  }

  &:focus-visible {
    outline: 1px solid var(--scheme-color-secondary);
    outline-offset: -1px;
  }
}

.sing-minimap-zoom-slider {
  appearance: none;
  width: 100%;
  min-width: 0;
  height: 18px;
  margin: 0;
  background: transparent;
  cursor: pointer;

  &::-webkit-slider-runnable-track {
    height: 3px;
    border-radius: 999px;
    background: color-mix(
      in oklch,
      var(--scheme-color-outline) 36%,
      transparent
    );
  }

  &::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -4.5px;
    border: 1px solid
      color-mix(in oklch, var(--scheme-color-outline) 36%, transparent);
    border-radius: 50%;
    background: var(--scheme-color-surface-container-highest);
  }

  &::-moz-range-track {
    height: 3px;
    border-radius: 999px;
    background: color-mix(
      in oklch,
      var(--scheme-color-outline) 36%,
      transparent
    );
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: 1px solid
      color-mix(in oklch, var(--scheme-color-outline) 36%, transparent);
    border-radius: 50%;
    background: var(--scheme-color-surface-container-highest);
  }
}

.sing-minimap-content {
  appearance: none;
  position: relative;
  display: block;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  overflow: hidden;
  transform-origin: left top;
  will-change: transform;

  &:hover {
    background: linear-gradient(
      180deg,
      transparent 0,
      transparent 49%,
      color-mix(in oklch, var(--scheme-color-outline-variant) 34%, transparent)
        50%,
      transparent 51%,
      transparent 100%
    );
  }

  &:focus-visible {
    outline: 2px solid var(--scheme-color-secondary);
    outline-offset: -2px;
  }
}

.sing-minimap-grid {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(
      90deg,
      color-mix(in oklch, var(--scheme-color-outline-variant) 30%, transparent)
        0,
      color-mix(in oklch, var(--scheme-color-outline-variant) 30%, transparent)
        1px,
      transparent 1px,
      transparent 48px
    ),
    repeating-linear-gradient(
      180deg,
      transparent 0,
      transparent 13px,
      color-mix(in oklch, var(--scheme-color-outline-variant) 18%, transparent)
        13px,
      color-mix(in oklch, var(--scheme-color-outline-variant) 18%, transparent)
        14px
    );
}

.sing-minimap-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 4;
  width: 2px;
  transform: translateX(-1px);
  background: var(--scheme-color-inverse-surface);
  pointer-events: none;
}

.sing-minimap-phrase-lyric {
  position: absolute;
  top: 4px;
  z-index: 3;
  display: flex;
  align-items: center;
  height: 15px;
  min-width: 18px;
  padding: 0 4px;
  color: var(--scheme-color-on-surface);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  overflow: hidden;
  pointer-events: none;
  text-align: left;

  span {
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.sing-minimap-note {
  position: absolute;
  z-index: 2;
  height: 4px;
  min-width: 4px;
  padding: 0;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-secondary) 32%, transparent);
  border-radius: 999px;
  background: color-mix(
    in oklch,
    var(--scheme-color-secondary-container) 58%,
    var(--scheme-color-surface-container-highest)
  );
  color: var(--scheme-color-on-secondary-container);
  overflow: hidden;
}
</style>
