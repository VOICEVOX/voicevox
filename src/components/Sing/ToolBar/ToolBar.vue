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
        <div class="sing-track-preview" aria-hidden="true">
          <div class="sing-track-preview-grid"></div>
          <div class="sing-track-preview-viewport"></div>
          <div
            v-for="previewNote in previewNotes"
            :key="previewNote.id"
            class="sing-track-preview-note"
            :style="{
              left: `${previewNote.left}%`,
              width: `${previewNote.width}%`,
              top: `${previewNote.top}%`,
            }"
          ></div>
        </div>
      </div>
    </div>
  </QToolbar>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "@/store";
import {
  isValidKeyRangeAdjustment,
  isValidVolumeRangeAdjustment,
} from "@/sing/domain";
import CharacterMenuButton from "@/components/Sing/CharacterMenuButton/MenuButton.vue";

const store = useStore();

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

const setSingingTeacher = (event: Event) => {
  singingTeacherLabel.value = (event.target as HTMLSelectElement).value;
};

const previewNotes = computed(() => {
  const notes = selectedTrack.value.notes;
  if (notes.length === 0) {
    return [];
  }

  const maxTick = Math.max(
    ...notes.map((note) => note.position + note.duration),
    1,
  );
  const minNoteNumber = Math.min(...notes.map((note) => note.noteNumber));
  const maxNoteNumber = Math.max(...notes.map((note) => note.noteNumber));
  const noteNumberRange = Math.max(maxNoteNumber - minNoteNumber, 12);

  return notes.map((note) => ({
    id: note.id,
    left: (note.position / maxTick) * 100,
    width: Math.max((note.duration / maxTick) * 100, 0.8),
    top:
      18 +
      ((maxNoteNumber - note.noteNumber + noteNumberRange * 0.08) /
        (noteNumberRange * 1.16)) *
        64,
  }));
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
  min-height: 76px;
  padding: 10px 14px 10px 8px;
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
  height: 56px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 38%, transparent);
  border-radius: 6px;
  background: var(--scheme-color-surface-container-highest);
  overflow: hidden;
}

.sing-track-header {
  display: flex;
  align-items: stretch;
  flex: 0 0 296px;
  min-width: 0;
  padding: 0;
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 34%, transparent);
  background: var(--scheme-color-surface-container-highest);
}

.sing-track-header :deep(.q-btn) {
  height: 100%;
  min-width: 0;
  max-width: 164px;
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
  padding: 5px 8px 5px 12px;
  width: 136px;
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
    column-gap: 8px;
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

.sing-track-preview {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  background:
    linear-gradient(
      180deg,
      transparent 0,
      transparent 49%,
      color-mix(in oklch, var(--scheme-color-outline-variant) 20%, transparent)
        50%,
      transparent 51%,
      transparent 100%
    ),
    color-mix(
      in oklch,
      var(--scheme-color-surface-container-low) 58%,
      var(--scheme-color-surface-container-high)
    );
  overflow: hidden;
}

.sing-track-preview-grid {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    90deg,
    color-mix(in oklch, var(--scheme-color-outline-variant) 30%, transparent) 0,
    color-mix(in oklch, var(--scheme-color-outline-variant) 30%, transparent)
      1px,
    transparent 1px,
    transparent 64px
  );
}

.sing-track-preview-viewport {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 42%;
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline) 42%, transparent);
  border-left: 1px solid
    color-mix(in oklch, var(--scheme-color-outline) 26%, transparent);
  border-radius: 0;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-highest) 32%,
    transparent
  );
  pointer-events: none;
}

.sing-track-preview-note {
  position: absolute;
  z-index: 1;
  height: 6px;
  min-width: 4px;
  border-radius: 999px;
  background: color-mix(
    in oklch,
    var(--scheme-color-secondary-container) 48%,
    var(--scheme-color-outline-variant)
  );
  opacity: 0.72;
}
</style>
