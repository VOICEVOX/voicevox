<template>
  <QToolbar
    class="sing-toolbar"
    :class="[
      `mode-${arrangementDisclosureMode}`,
      `arrangement-mode-${arrangementModeSide}`,
      { 'multitrack-resizing': isMultitrackResizing },
    ]"
    :style="arrangementToolbarStyle"
  >
    <div class="sing-track-lane">
      <div class="sing-arrangement-mode-column">
        <button
          class="sing-arrangement-toggle-button"
          :class="{ active: arrangementDisclosureMode === 'expanded' }"
          type="button"
          :aria-pressed="arrangementDisclosureMode === 'expanded'"
          :aria-label="
            arrangementDisclosureMode === 'expanded'
              ? 'アレンジメント表示を折りたたむ'
              : 'アレンジメント表示を展開'
          "
          :title="
            arrangementDisclosureMode === 'expanded'
              ? 'アレンジメント表示を折りたたむ'
              : 'アレンジメント表示を展開'
          "
          @click="toggleArrangementDisclosureMode"
        >
          <span class="material-symbols-rounded" aria-hidden="true">
            {{
              arrangementDisclosureMode === "expanded"
                ? "expand_less"
                : "expand_more"
            }}
          </span>
        </button>
      </div>
      <div
        class="sing-track-strip"
        :class="`mode-${arrangementDisclosureMode}`"
        @wheel="onMultitrackStripWheel"
      >
        <div
          class="sing-multitrack-header-column"
          :class="{ collapsed: arrangementDisclosureMode === 'collapsed' }"
        >
          <div
            ref="multitrackHeaderScrollRef"
            class="sing-multitrack-header-scroll"
            @scroll="onMultitrackHeaderScroll"
          >
            <div
              v-for="row in visibleArrangementRows"
              :key="row.id"
              class="sing-multitrack-header-row"
              :class="{
                selected: row.isSelected,
                audio: row.kind === 'audio',
                inactive: !row.shouldPlay,
              }"
              @click="selectArrangementRow(row)"
            >
              <div class="sing-multitrack-avatar">
                <template v-if="row.kind === 'singer'">
                  <SingerIcon
                    v-if="row.characterStyle"
                    round
                    size="28px"
                    :style="row.characterStyle"
                  />
                  <span v-else class="sing-multitrack-avatar-placeholder"
                    >?</span
                  >
                  <CharacterSelectMenu
                    v-if="row.trackId != undefined"
                    :trackId="row.trackId"
                  />
                </template>
                <span
                  v-else
                  class="material-symbols-rounded"
                  aria-hidden="true"
                >
                  graphic_eq
                </span>
              </div>
              <div class="sing-multitrack-header-main">
                <input
                  v-if="row.kind === 'singer' && row.isNameEditing"
                  class="sing-multitrack-track-name-input"
                  type="text"
                  :value="row.name"
                  :disabled="uiLocked"
                  aria-label="トラック名"
                  autofocus
                  @blur="finishMultitrackTrackNameEdit(row, $event)"
                  @keydown.enter.prevent="blurCurrentInput"
                  @keydown.escape.prevent="cancelMultitrackTrackNameEdit"
                />
                <button
                  v-else-if="row.kind === 'singer'"
                  class="sing-multitrack-track-name"
                  type="button"
                  :disabled="uiLocked"
                  aria-label="トラック名を編集"
                  @dblclick.stop="startMultitrackTrackNameEdit(row)"
                >
                  {{ row.name }}
                </button>
                <span v-else class="sing-multitrack-track-name">{{
                  row.name
                }}</span>
                <span class="sing-multitrack-track-status">
                  {{ row.statusLabel }}
                </span>
                <div
                  v-if="row.kind === 'audio' && row.isSelected"
                  class="sing-audio-alignment-row"
                  @click.stop
                  @pointerdown.stop
                >
                  <label class="sing-audio-offset-field">
                    <input
                      type="number"
                      :value="audioAlignmentOffsetMs"
                      aria-label="オーディオオフセット"
                      @change="setAudioOffsetFromInput"
                    />
                    <span>ms</span>
                  </label>
                  <div class="sing-audio-nudge-group" aria-label="ナッジ">
                    <button
                      class="sing-audio-nudge-button"
                      type="button"
                      aria-label="10ms早く"
                      @click="nudgeAudioOffset(-10)"
                    >
                      -10
                    </button>
                    <button
                      class="sing-audio-nudge-button"
                      type="button"
                      aria-label="1ms早く"
                      @click="nudgeAudioOffset(-1)"
                    >
                      -1
                    </button>
                    <button
                      class="sing-audio-nudge-button"
                      type="button"
                      aria-label="1ms遅く"
                      @click="nudgeAudioOffset(1)"
                    >
                      +1
                    </button>
                    <button
                      class="sing-audio-nudge-button"
                      type="button"
                      aria-label="10ms遅く"
                      @click="nudgeAudioOffset(10)"
                    >
                      +10
                    </button>
                  </div>
                  <label class="sing-audio-snap-toggle">
                    <input
                      type="checkbox"
                      :checked="audioAlignment.snapToGrid"
                      @change="toggleAudioSnap"
                    />
                    <span>Snap</span>
                  </label>
                </div>
                <div
                  v-if="row.kind === 'singer'"
                  class="sing-multitrack-mix-row"
                >
                  <label
                    class="sing-multitrack-gain"
                    :class="{
                      active: isMultitrackControlActive(row, 'gain'),
                    }"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">
                      volume_up
                    </span>
                    <input
                      class="sing-multitrack-gain-slider"
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      :value="row.gain"
                      :disabled="uiLocked"
                      aria-label="トラック音量"
                      @input="previewMultitrackTrackGain(row, $event)"
                      @change="commitMultitrackTrackGain(row, $event)"
                      @pointerdown="previewMultitrackTrackGain(row, $event)"
                      @blur="clearMultitrackControl(row, 'gain')"
                      @dblclick="setMultitrackTrackGain(row, 1)"
                    />
                    <span class="sing-multitrack-control-value">
                      {{ getMultitrackGainDisplayLabel(row) }}
                    </span>
                  </label>
                  <label
                    class="sing-multitrack-pan"
                    :class="{ active: isMultitrackControlActive(row, 'pan') }"
                  >
                    <span class="sing-multitrack-pan-side">L</span>
                    <input
                      class="sing-multitrack-pan-slider"
                      type="range"
                      min="-1"
                      max="1"
                      step="0.01"
                      :value="row.pan"
                      :disabled="uiLocked"
                      aria-label="トラックパン"
                      @input="previewMultitrackTrackPan(row, $event)"
                      @change="commitMultitrackTrackPan(row, $event)"
                      @pointerdown="previewMultitrackTrackPan(row, $event)"
                      @blur="clearMultitrackControl(row, 'pan')"
                      @dblclick="setMultitrackTrackPan(row, 0)"
                    />
                    <span class="sing-multitrack-pan-side">R</span>
                    <span class="sing-multitrack-control-value">
                      {{ getMultitrackPanDisplayLabel(row) }}
                    </span>
                  </label>
                </div>
              </div>
              <div v-if="row.kind === 'singer'" class="sing-multitrack-actions">
                <button
                  v-if="row.errorCount > 0"
                  class="sing-multitrack-error-badge"
                  type="button"
                  aria-label="最初のエラーへ移動"
                  @click.stop="jumpToFirstTrackError(row)"
                >
                  {{ row.errorCount }}
                </button>
                <button
                  class="sing-multitrack-state-button"
                  :class="{ active: row.isMuted }"
                  type="button"
                  :disabled="uiLocked || isThereSoloTrack"
                  aria-label="ミュート"
                  @click.stop="setMultitrackTrackMute(row, !row.isMuted)"
                >
                  M
                </button>
                <button
                  class="sing-multitrack-state-button"
                  :class="{ active: row.isSolo }"
                  type="button"
                  :disabled="uiLocked"
                  aria-label="ソロ"
                  @click.stop="setMultitrackTrackSolo(row, !row.isSolo)"
                >
                  S
                </button>
                <button
                  class="sing-multitrack-more-button"
                  type="button"
                  aria-label="トラックメニュー"
                  @click.stop
                >
                  <span class="material-symbols-rounded" aria-hidden="true">
                    more_vert
                  </span>
                  <QMenu class="sing-multitrack-menu" anchor="bottom right">
                    <div class="sing-multitrack-menu-content" @click.stop>
                      <label class="sing-multitrack-menu-row">
                        <span>歌い方</span>
                        <select
                          class="sing-multitrack-menu-control"
                          :value="row.singingTeacherLabel"
                          :disabled="uiLocked"
                          @change="setMultitrackSingingTeacher(row, $event)"
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
                      <label class="sing-multitrack-menu-row">
                        <span>音域</span>
                        <input
                          class="sing-multitrack-menu-control number"
                          type="number"
                          :value="row.keyRangeAdjustment"
                          :disabled="uiLocked"
                          @change="setMultitrackKeyRangeAdjustment(row, $event)"
                        />
                      </label>
                      <label class="sing-multitrack-menu-row">
                        <span>声量</span>
                        <input
                          class="sing-multitrack-menu-control number"
                          type="number"
                          :value="row.volumeRangeAdjustment"
                          :disabled="uiLocked"
                          @change="
                            setMultitrackVolumeRangeAdjustment(row, $event)
                          "
                        />
                      </label>
                      <button
                        v-close-popup
                        class="sing-multitrack-menu-command danger"
                        type="button"
                        :disabled="uiLocked || tracks.size <= 1"
                        @click="deleteTrackFromRow(row)"
                      >
                        トラック削除
                      </button>
                    </div>
                  </QMenu>
                </button>
              </div>
              <div v-else class="sing-multitrack-actions audio-actions">
                <button
                  class="sing-multitrack-more-button"
                  type="button"
                  aria-label="オーディオトラックメニュー"
                  @click.stop
                >
                  <span class="material-symbols-rounded" aria-hidden="true">
                    more_vert
                  </span>
                  <QMenu class="sing-multitrack-menu" anchor="bottom right">
                    <div class="sing-multitrack-menu-content" @click.stop>
                      <button
                        v-close-popup
                        class="sing-multitrack-menu-command"
                        type="button"
                        @click="moveAudioClipStartToPlayhead"
                      >
                        先頭を再生位置へ
                      </button>
                      <button
                        v-close-popup
                        class="sing-multitrack-menu-command"
                        type="button"
                        @click="nudgeAudioOffset(-10)"
                      >
                        10ms早く
                      </button>
                      <button
                        v-close-popup
                        class="sing-multitrack-menu-command"
                        type="button"
                        @click="nudgeAudioOffset(10)"
                      >
                        10ms遅く
                      </button>
                    </div>
                  </QMenu>
                </button>
              </div>
              <QMenu
                v-if="row.kind === 'audio'"
                class="sing-multitrack-menu"
                contextMenu
                touchPosition
              >
                <div class="sing-multitrack-menu-content" @click.stop>
                  <button
                    v-close-popup
                    class="sing-multitrack-menu-command"
                    type="button"
                    @click="moveAudioClipStartToPlayhead"
                  >
                    先頭を再生位置へ
                  </button>
                  <button
                    v-close-popup
                    class="sing-multitrack-menu-command"
                    type="button"
                    @click="nudgeAudioOffset(-10)"
                  >
                    10ms早く
                  </button>
                  <button
                    v-close-popup
                    class="sing-multitrack-menu-command"
                    type="button"
                    @click="nudgeAudioOffset(10)"
                  >
                    10ms遅く
                  </button>
                </div>
              </QMenu>
            </div>
          </div>
          <div
            v-if="arrangementDisclosureMode === 'expanded'"
            class="sing-multitrack-footer-row"
            aria-label="トラック操作"
          >
            <button
              class="sing-multitrack-add-button"
              type="button"
              :disabled="uiLocked"
              @click="addTrackAfterSelected"
            >
              <span class="material-symbols-rounded" aria-hidden="true">
                add
              </span>
              <span>トラック追加</span>
            </button>
            <button
              class="sing-multitrack-footer-icon-button"
              type="button"
              :disabled="uiLocked || areAllTracksMuted"
              aria-label="すべてのトラックをミュート"
              @click="muteAllTracks"
            >
              <span class="material-symbols-rounded" aria-hidden="true">
                volume_off
              </span>
              <span>全ミュート</span>
            </button>
          </div>
        </div>
        <div class="sing-singer-map">
          <div
            class="sing-minimap-layout"
            :class="`mode-${arrangementDisclosureMode}`"
          >
            <div ref="minimapViewportRef" class="sing-minimap-viewport">
              <div
                ref="multitrackMapScrollRef"
                class="sing-multitrack-map-scroll"
                :class="{
                  collapsed: arrangementDisclosureMode === 'collapsed',
                  dragging: isMinimapWindowNavigating,
                }"
                @scroll="onMultitrackMapScroll"
              >
                <div
                  class="sing-multitrack-content"
                  role="button"
                  tabindex="0"
                  aria-label="マルチトラック概要の位置へ移動"
                  :style="{
                    width: minimapContentWidthStyle,
                  }"
                  @click="setPlayheadFromMinimap"
                  @keydown.left.prevent="navigateMinimapWindowByKeyboard(-1)"
                  @keydown.right.prevent="navigateMinimapWindowByKeyboard(1)"
                >
                  <div
                    v-if="sequencerVisibleRange.width > 0"
                    class="sing-multitrack-sequencer-window"
                    :style="{
                      left: `${sequencerVisibleRange.left}%`,
                      width: `${sequencerVisibleRange.width}%`,
                    }"
                    @pointerdown.stop="onMinimapWindowPointerDown"
                    @click.stop
                  ></div>
                  <div
                    class="sing-multitrack-playhead"
                    :style="{ left: `${minimapPlayheadPosition}%` }"
                  ></div>
                  <div class="sing-multitrack-grid"></div>
                  <div
                    v-for="row in visibleArrangementRows"
                    :key="row.id"
                    class="sing-multitrack-map-row"
                    :class="{
                      selected: row.isSelected,
                      audio: row.kind === 'audio',
                    }"
                  >
                    <div
                      v-for="marker in row.errorMarkers"
                      :key="marker.id"
                      class="sing-multitrack-error-marker"
                      :style="{ left: `${marker.left}%` }"
                    ></div>
                    <template v-if="row.isSelected">
                      <button
                        v-for="phraseLyric in row.phraseLyrics"
                        :key="phraseLyric.id"
                        class="sing-multitrack-phrase-lyric"
                        type="button"
                        :style="{
                          left: `${phraseLyric.left}%`,
                          width: `${phraseLyric.width}%`,
                        }"
                        @click.stop="jumpToTick(phraseLyric.startTick)"
                      >
                        {{ phraseLyric.text }}
                      </button>
                    </template>
                    <template v-if="row.kind === 'singer'">
                      <div
                        v-for="previewNote in row.notes"
                        :key="previewNote.id"
                        class="sing-multitrack-note"
                        :class="{ error: previewNote.isError }"
                        :style="{
                          left: `${previewNote.left}%`,
                          width: `${previewNote.width}%`,
                          top: `${previewNote.top}%`,
                        }"
                      ></div>
                    </template>
                    <template v-else>
                      <div
                        v-for="clip in row.clips"
                        :key="clip.id"
                        class="sing-multitrack-audio-clip"
                        :class="{
                          dragging: draggingAudioClipId === clip.id,
                          selected: audioAlignment.selectedClipId === clip.id,
                        }"
                        :style="{
                          left: `${clip.left}%`,
                          width: `${clip.width}%`,
                        }"
                        @click.stop
                        @pointerdown.stop="
                          startMultitrackAudioClipDrag($event, clip)
                        "
                      >
                        <span
                          class="sing-multitrack-audio-head-handle"
                          aria-hidden="true"
                        ></span>
                        <span
                          v-for="(peak, peakIndex) in clip.peaks"
                          :key="peakIndex"
                          class="sing-multitrack-audio-peak"
                          :style="{ height: `${peak}%` }"
                        ></span>
                        <button
                          class="sing-multitrack-clip-menu-button"
                          type="button"
                          aria-label="オーディオクリップメニュー"
                          @click.stop
                          @pointerdown.stop
                        >
                          <span
                            class="material-symbols-rounded"
                            aria-hidden="true"
                          >
                            more_horiz
                          </span>
                          <QMenu
                            class="sing-multitrack-menu"
                            anchor="bottom right"
                          >
                            <div
                              class="sing-multitrack-menu-content"
                              @click.stop
                            >
                              <button
                                v-close-popup
                                class="sing-multitrack-menu-command"
                                type="button"
                                @click="moveAudioClipStartToPlayhead"
                              >
                                先頭を再生位置へ
                              </button>
                              <button
                                v-close-popup
                                class="sing-multitrack-menu-command"
                                type="button"
                                @click="nudgeAudioOffset(-10)"
                              >
                                10ms早く
                              </button>
                              <button
                                v-close-popup
                                class="sing-multitrack-menu-command"
                                type="button"
                                @click="nudgeAudioOffset(10)"
                              >
                                10ms遅く
                              </button>
                            </div>
                          </QMenu>
                        </button>
                        <QMenu
                          class="sing-multitrack-menu"
                          contextMenu
                          touchPosition
                        >
                          <div class="sing-multitrack-menu-content" @click.stop>
                            <button
                              v-close-popup
                              class="sing-multitrack-menu-command"
                              type="button"
                              @click="moveAudioClipStartToPlayhead"
                            >
                              先頭を再生位置へ
                            </button>
                            <button
                              v-close-popup
                              class="sing-multitrack-menu-command"
                              type="button"
                              @click="nudgeAudioOffset(-10)"
                            >
                              10ms早く
                            </button>
                            <button
                              v-close-popup
                              class="sing-multitrack-menu-command"
                              type="button"
                              @click="nudgeAudioOffset(10)"
                            >
                              10ms遅く
                            </button>
                          </div>
                        </QMenu>
                      </div>
                    </template>
                  </div>
                  <div
                    v-if="arrangementDisclosureMode === 'expanded'"
                    class="sing-multitrack-map-footer-spacer"
                    aria-hidden="true"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          v-if="arrangementDisclosureMode === 'expanded'"
          class="sing-multitrack-resize-handle"
          role="separator"
          aria-orientation="horizontal"
          aria-label="マルチトラック表示の高さ"
          @pointerdown="startMultitrackResize"
        ></div>
      </div>
    </div>
  </QToolbar>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useStore } from "@/store";
import {
  getEndTicksOfPhrase,
  getDefaultLyric,
  getStartTicksOfPhrase,
  isValidKeyRangeAdjustment,
  isValidVolumeRangeAdjustment,
  shouldPlayTracks,
} from "@/sing/domain";
import {
  getTimeSignaturePositions,
  tickToMeasureNumber,
  tickToSecond,
} from "@/sing/music";
import { getTotalTicks } from "@/sing/rulerHelper";
import { SEQUENCER_MIN_NUM_MEASURES } from "@/sing/viewHelper";
import CharacterSelectMenu from "@/components/Sing/CharacterMenuButton/CharacterSelectMenu.vue";
import SingerIcon from "@/components/Sing/SingerIcon.vue";
import type { Note } from "@/domain/project/type";
import type { StyleInfo, TrackId } from "@/type/preload";
import type { ToolPaletteLayout } from "@/components/Sing/toolPaletteLayout";
import type { SequencerViewportState } from "@/components/Sing/ScoreSequencer.vue";
import {
  MOCK_AUDIO_CLIP_BASE_LEFT_PERCENT,
  MOCK_AUDIO_CLIP_ID,
  MOCK_AUDIO_CLIP_WIDTH_PERCENT,
  MOCK_AUDIO_PEAKS,
  MOCK_AUDIO_TRACK_ID,
  formatAudioAlignmentOffsetMs,
  getAudioAlignmentMeasureDurationMs,
  getAudioAlignmentOffsetMs,
  splitAudioAlignmentOffsetMs,
  type AudioAlignmentMockState,
} from "@/components/Sing/audioAlignmentMock";

const store = useStore();
const props = defineProps<{
  toolPaletteLayout: ToolPaletteLayout;
  sequencerViewport: SequencerViewportState;
}>();
const emit = defineEmits<{
  navigateSequencer: [scrollLeft: number];
}>();
const audioAlignment = defineModel<AudioAlignmentMockState>("audioAlignment", {
  required: true,
});
const MINIMAP_NOTE_LOW_NOTE_NUMBER = 48;
const MINIMAP_NOTE_HIGH_NOTE_NUMBER = 84;
const MINIMAP_NOTE_RANGE_PADDING = 2;
const MINIMAP_NOTE_RANGE_MIN_SEMITONES = 12;
const COLLAPSED_ARRANGEMENT_HEIGHT = 72;
const MULTITRACK_ARRANGEMENT_HEIGHT_MIN = 144;
const MULTITRACK_ARRANGEMENT_HEIGHT_MAX = 420;
const MULTITRACK_ARRANGEMENT_HEIGHT_DEFAULT = 184;
const ARRANGEMENT_NOTE_TOP_OFFSET_SELECTED = 24;
const ARRANGEMENT_NOTE_VERTICAL_RANGE_SELECTED = 40;
const ARRANGEMENT_NOTE_TOP_OFFSET_COMPACT = 16;
const ARRANGEMENT_NOTE_VERTICAL_RANGE_COMPACT = 22;
type ArrangementDisclosureMode = "collapsed" | "expanded";

type PreviewNote = {
  id: string;
  left: number;
  width: number;
  top: number;
  isError: boolean;
};

type PreviewAudioClip = {
  id: string;
  left: number;
  width: number;
  peaks: number[];
};

type PhraseLyricMarker = {
  id: string;
  left: number;
  width: number;
  startTick: number;
  text: string;
};

type ErrorMarker = {
  id: string;
  left: number;
  startTick: number;
};

type MultitrackControlTarget = "gain" | "pan";

type ArrangementRow = {
  id: string;
  kind: "singer" | "audio";
  trackId?: TrackId;
  name: string;
  isNameEditing: boolean;
  singerName: string;
  singingTeacherLabel: string;
  characterStyle?: StyleInfo;
  statusLabel: string;
  isSelected: boolean;
  isSolo: boolean;
  isMuted: boolean;
  gain: number;
  pan: number;
  panLabel: string;
  shouldPlay: boolean;
  keyRangeAdjustment: number;
  volumeRangeAdjustment: number;
  phraseLyrics: PhraseLyricMarker[];
  errorMarkers: ErrorMarker[];
  errorCount: number;
  notes: PreviewNote[];
  clips: PreviewAudioClip[];
};

const arrangementDisclosureMode = ref<ArrangementDisclosureMode>("collapsed");
const multitrackArrangementHeight = ref(MULTITRACK_ARRANGEMENT_HEIGHT_DEFAULT);
const isMultitrackResizing = ref(false);
const editingTrackNameId = ref<TrackId>();
const multitrackSingingTeacherLabels = ref<Record<string, string>>({});
const activeMultitrackControl = ref<{
  rowId: string;
  target: MultitrackControlTarget;
  value: number;
}>();
const draggingAudioClipId = ref<string>();
let multitrackResizeStartY = 0;
let multitrackResizeStartHeight = MULTITRACK_ARRANGEMENT_HEIGHT_DEFAULT;
let audioClipDragStartClientX = 0;
let audioClipDragStartCoarseMeasureOffset = 0;

const arrangementToolbarStyle = computed<Record<string, string>>(() => ({
  "--sing-collapsed-arrangement-height": `${COLLAPSED_ARRANGEMENT_HEIGHT}px`,
  "--sing-multitrack-arrangement-height": `${multitrackArrangementHeight.value}px`,
}));
const arrangementModeSide = computed<"left" | "right">(() =>
  props.toolPaletteLayout === "sideRight" ? "right" : "left",
);
const toggleArrangementDisclosureMode = () => {
  arrangementDisclosureMode.value =
    arrangementDisclosureMode.value === "expanded" ? "collapsed" : "expanded";
  void nextTick(updateMinimapViewportWidth);
};
const setMultitrackArrangementHeight = (height: number) => {
  multitrackArrangementHeight.value = Math.max(
    MULTITRACK_ARRANGEMENT_HEIGHT_MIN,
    Math.min(height, MULTITRACK_ARRANGEMENT_HEIGHT_MAX),
  );
  updateMinimapViewportWidth();
};
const onMultitrackResizePointerMove = (event: PointerEvent) => {
  event.preventDefault();
  setMultitrackArrangementHeight(
    multitrackResizeStartHeight + event.clientY - multitrackResizeStartY,
  );
};
const stopMultitrackResize = () => {
  isMultitrackResizing.value = false;
  window.removeEventListener("pointermove", onMultitrackResizePointerMove);
  window.removeEventListener("pointerup", stopMultitrackResize);
  window.removeEventListener("pointercancel", stopMultitrackResize);
};
const startMultitrackResize = (event: PointerEvent) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  event.preventDefault();
  isMultitrackResizing.value = true;
  multitrackResizeStartY = event.clientY;
  multitrackResizeStartHeight = multitrackArrangementHeight.value;
  window.addEventListener("pointermove", onMultitrackResizePointerMove);
  window.addEventListener("pointerup", stopMultitrackResize);
  window.addEventListener("pointercancel", stopMultitrackResize);
};
const onMultitrackAudioClipDragPointerMove = (event: PointerEvent) => {
  event.preventDefault();
  const deltaPercent =
    ((event.clientX - audioClipDragStartClientX) /
      Math.max(minimapContentWidth.value, 1)) *
    100;
  const measureStepPercent = audioClipMeasureStepPercent.value;
  const deltaMeasures =
    measureStepPercent === 0
      ? 0
      : Math.round(deltaPercent / measureStepPercent);
  audioAlignment.value = {
    ...audioAlignment.value,
    coarseMeasureOffset: audioClipDragStartCoarseMeasureOffset + deltaMeasures,
    selectedClipId: MOCK_AUDIO_CLIP_ID,
  };
};
const stopMultitrackAudioClipDrag = () => {
  draggingAudioClipId.value = undefined;
  window.removeEventListener(
    "pointermove",
    onMultitrackAudioClipDragPointerMove,
  );
  window.removeEventListener("pointerup", stopMultitrackAudioClipDrag);
  window.removeEventListener("pointercancel", stopMultitrackAudioClipDrag);
};
const startMultitrackAudioClipDrag = (
  event: PointerEvent,
  clip: PreviewAudioClip,
) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  event.preventDefault();
  draggingAudioClipId.value = clip.id;
  audioAlignment.value = {
    ...audioAlignment.value,
    selectedClipId: clip.id,
  };
  audioClipDragStartClientX = event.clientX;
  audioClipDragStartCoarseMeasureOffset =
    audioAlignment.value.coarseMeasureOffset;
  window.addEventListener("pointermove", onMultitrackAudioClipDragPointerMove);
  window.addEventListener("pointerup", stopMultitrackAudioClipDrag);
  window.addEventListener("pointercancel", stopMultitrackAudioClipDrag);
};

const selectedTrack = computed(() => store.getters.SELECTED_TRACK);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const uiLocked = computed(() => store.getters.UI_LOCKED);
const tracks = computed(() => store.state.tracks);
const trackOrder = computed(() => store.state.trackOrder);
const isThereSoloTrack = computed(() =>
  [...tracks.value.values()].some((track) => track.solo),
);
const areAllTracksMuted = computed(() =>
  trackOrder.value.every((trackId) => tracks.value.get(trackId)?.mute),
);
const playableTrackIds = computed(() => shouldPlayTracks(store.state.tracks));
const singingTeacherLabel = ref("波音リツ");
const singingTeacherOptions = ["波音リツ", "ずんだもん", "四国めたん"];
const minimapViewportRef = ref<HTMLElement>();
const multitrackHeaderScrollRef = ref<HTMLElement>();
const multitrackMapScrollRef = ref<HTMLElement>();
const minimapViewportWidth = ref(0);
const isMinimapWindowNavigating = ref(false);
let minimapResizeObserver: ResizeObserver | undefined;
let isSyncingMultitrackVerticalScroll = false;

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
const minimapContentWidth = computed(() =>
  Math.max(minimapViewportWidth.value, 1),
);
const minimapContentWidthStyle = computed(
  () => `${minimapContentWidth.value}px`,
);
const sequencerVisibleRange = computed(() => {
  const sequencerContentWidth = Math.max(
    props.sequencerViewport.scrollWidth,
    1,
  );
  const clientWidth = Math.max(props.sequencerViewport.clientWidth, 0);

  return {
    left: clampPercent(
      (props.sequencerViewport.scrollLeft / sequencerContentWidth) * 100,
    ),
    width:
      clientWidth === 0
        ? 0
        : clampPercent((clientWidth / sequencerContentWidth) * 100),
  };
});
const getSequencerScrollMax = () =>
  Math.max(
    props.sequencerViewport.scrollWidth - props.sequencerViewport.clientWidth,
    0,
  );
const navigateSequencerToScrollLeft = (scrollLeft: number) => {
  emit(
    "navigateSequencer",
    Math.max(0, Math.min(scrollLeft, getSequencerScrollMax())),
  );
};
const navigateSequencerToRatio = (ratio: number) => {
  const sequencerContentWidth = Math.max(
    props.sequencerViewport.scrollWidth,
    1,
  );
  const clientWidth = Math.max(props.sequencerViewport.clientWidth, 0);
  navigateSequencerToScrollLeft(
    ratio * sequencerContentWidth - clientWidth / 2,
  );
};
const getMinimapPointerRatio = (clientX: number) => {
  const minimapViewportElement = minimapViewportRef.value;
  if (minimapViewportElement == undefined) return 0;

  const rect = minimapViewportElement.getBoundingClientRect();
  return Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
};
const onMinimapWindowPointerMove = (event: PointerEvent) => {
  event.preventDefault();
  navigateSequencerToRatio(getMinimapPointerRatio(event.clientX));
};
const stopMinimapWindowNavigation = () => {
  isMinimapWindowNavigating.value = false;
  window.removeEventListener("pointermove", onMinimapWindowPointerMove);
  window.removeEventListener("pointerup", stopMinimapWindowNavigation);
  window.removeEventListener("pointercancel", stopMinimapWindowNavigation);
};
const onMinimapWindowPointerDown = (event: PointerEvent) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  event.preventDefault();
  isMinimapWindowNavigating.value = true;
  navigateSequencerToRatio(getMinimapPointerRatio(event.clientX));
  window.addEventListener("pointermove", onMinimapWindowPointerMove);
  window.addEventListener("pointerup", stopMinimapWindowNavigation);
  window.addEventListener("pointercancel", stopMinimapWindowNavigation);
};
const navigateMinimapWindowByKeyboard = (direction: -1 | 1) => {
  navigateSequencerToScrollLeft(
    props.sequencerViewport.scrollLeft +
      direction * Math.max(props.sequencerViewport.clientWidth * 0.8, 1),
  );
};
const updateMinimapViewportWidth = () => {
  minimapViewportWidth.value = minimapViewportRef.value?.clientWidth ?? 0;
};
const syncMultitrackVerticalScroll = (
  source: HTMLElement,
  target: HTMLElement | undefined,
) => {
  if (target == undefined || isSyncingMultitrackVerticalScroll) return;

  isSyncingMultitrackVerticalScroll = true;
  const targetScrollMax = Math.max(
    target.scrollHeight - target.clientHeight,
    0,
  );
  target.scrollTop = Math.min(source.scrollTop, targetScrollMax);
  requestAnimationFrame(() => {
    isSyncingMultitrackVerticalScroll = false;
  });
};
const onMultitrackHeaderScroll = (event: Event) => {
  syncMultitrackVerticalScroll(
    event.currentTarget as HTMLElement,
    multitrackMapScrollRef.value,
  );
};
const onMultitrackMapScroll = (event: Event) => {
  syncMultitrackVerticalScroll(
    event.currentTarget as HTMLElement,
    multitrackHeaderScrollRef.value,
  );
};
const onMultitrackStripWheel = (event: WheelEvent) => {
  if (arrangementDisclosureMode.value !== "expanded") return;
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

  const targetElement =
    event.target instanceof Element ? event.target : undefined;
  if (
    targetElement?.closest(
      ".sing-multitrack-header-scroll, .sing-multitrack-map-scroll",
    ) != undefined
  ) {
    return;
  }

  const mapScrollElement = multitrackMapScrollRef.value;
  if (mapScrollElement == undefined) return;

  event.preventDefault();
  mapScrollElement.scrollTop += event.deltaY;
  syncMultitrackVerticalScroll(
    mapScrollElement,
    multitrackHeaderScrollRef.value,
  );
};
const arrangementMeasureCount = computed(() => {
  const tpqn = Math.max(store.state.tpqn, 1);
  const timeSignatures = store.state.timeSignatures;
  if (timeSignatures.length === 0) return SEQUENCER_MIN_NUM_MEASURES;

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

  return Math.max(
    SEQUENCER_MIN_NUM_MEASURES,
    tickToMeasureNumber(maxTick, timeSignatures, tpqn) + 8,
  );
});
const audioAlignmentMeasureDurationMs = computed(() =>
  getAudioAlignmentMeasureDurationMs({
    tempos: store.state.tempos,
    timeSignatures: store.state.timeSignatures,
  }),
);
const audioAlignmentOffsetMs = computed(() =>
  getAudioAlignmentOffsetMs(
    audioAlignment.value,
    audioAlignmentMeasureDurationMs.value,
  ),
);
const audioAlignmentOffsetLabel = computed(() =>
  formatAudioAlignmentOffsetMs(audioAlignmentOffsetMs.value),
);
const audioClipMeasureStepPercent = computed(
  () => 100 / Math.max(arrangementMeasureCount.value, 1),
);
const audioClipLeftPercent = computed(() =>
  Math.max(
    0,
    Math.min(
      MOCK_AUDIO_CLIP_BASE_LEFT_PERCENT +
        audioAlignment.value.coarseMeasureOffset *
          audioClipMeasureStepPercent.value,
      100 - MOCK_AUDIO_CLIP_WIDTH_PERCENT,
    ),
  ),
);
const setAudioOffsetMs = (offsetMs: number) => {
  audioAlignment.value = {
    ...audioAlignment.value,
    ...splitAudioAlignmentOffsetMs(
      offsetMs,
      audioAlignmentMeasureDurationMs.value,
    ),
    selectedClipId: MOCK_AUDIO_CLIP_ID,
  };
};
const nudgeAudioOffset = (deltaMs: number) => {
  setAudioOffsetMs(audioAlignmentOffsetMs.value + deltaMs);
};
const setAudioOffsetFromInput = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return;

  const value = Number(event.target.value);
  if (!Number.isFinite(value)) {
    event.target.value = String(audioAlignmentOffsetMs.value);
    return;
  }

  setAudioOffsetMs(value);
};
const toggleAudioSnap = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return;

  audioAlignment.value = {
    ...audioAlignment.value,
    snapToGrid: event.target.checked,
    selectedClipId: MOCK_AUDIO_CLIP_ID,
  };
};
const moveAudioClipStartToPlayhead = () => {
  const playheadSeconds = tickToSecond(
    store.getters.PLAYHEAD_POSITION,
    store.state.tempos,
    Math.max(store.state.tpqn, 1),
  );
  setAudioOffsetMs(Math.round(playheadSeconds * 1000));
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
  stopMinimapWindowNavigation();
  stopMultitrackResize();
  stopMultitrackAudioClipDrag();
});
const getLyricForNote = (note: Note) => {
  const explicitLyric = note.lyric?.trim();
  return explicitLyric && explicitLyric.length > 0
    ? explicitLyric
    : getDefaultLyric(note.noteNumber, store.state.defaultLyricMode);
};
const getMinimapNoteNumberRange = (notes: Note[]) => {
  if (notes.length === 0) {
    return {
      low: MINIMAP_NOTE_LOW_NOTE_NUMBER,
      high: MINIMAP_NOTE_HIGH_NOTE_NUMBER,
    };
  }

  const noteNumbers = notes.map((note) => note.noteNumber);
  let low = Math.min(...noteNumbers) - MINIMAP_NOTE_RANGE_PADDING;
  let high = Math.max(...noteNumbers) + MINIMAP_NOTE_RANGE_PADDING;
  const currentRange = high - low;
  if (currentRange < MINIMAP_NOTE_RANGE_MIN_SEMITONES) {
    const center = (low + high) / 2;
    low = center - MINIMAP_NOTE_RANGE_MIN_SEMITONES / 2;
    high = center + MINIMAP_NOTE_RANGE_MIN_SEMITONES / 2;
  }

  return {
    low: Math.max(0, low),
    high: Math.min(127, high),
  };
};
const createPreviewNotes = (
  notes: Note[],
  {
    errorNoteIds = new Set<string>(),
    noteNumberRange = {
      low: MINIMAP_NOTE_LOW_NOTE_NUMBER,
      high: MINIMAP_NOTE_HIGH_NOTE_NUMBER,
    },
    topOffset,
    verticalRange,
  }: {
    errorNoteIds?: Set<string>;
    noteNumberRange?: { low: number; high: number };
    topOffset: number;
    verticalRange: number;
  },
): PreviewNote[] => {
  if (notes.length === 0) return [];

  const noteNumberSpan = Math.max(
    noteNumberRange.high - noteNumberRange.low,
    1,
  );

  return notes.map((note) => {
    const noteNumber = Math.max(
      noteNumberRange.low,
      Math.min(note.noteNumber, noteNumberRange.high),
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
        topOffset +
        ((noteNumberRange.high - noteNumber) / noteNumberSpan) * verticalRange,
      isError: errorNoteIds.has(note.id),
    };
  });
};
const getErrorNoteIdsForTrack = (trackId: TrackId) => {
  const errorNoteIds = new Set<string>(
    store.getters.OVERLAPPING_NOTE_IDS(trackId),
  );

  for (const [, phrase] of store.state.phrases) {
    if (phrase.trackId !== trackId || phrase.state !== "COULD_NOT_RENDER") {
      continue;
    }

    for (const note of phrase.notes) {
      errorNoteIds.add(note.id);
    }
  }

  return errorNoteIds;
};
const createErrorMarkers = (
  notes: Note[],
  errorNoteIds: Set<string>,
): ErrorMarker[] => {
  return notes
    .filter((note) => errorNoteIds.has(note.id))
    .map((note) => ({
      id: `error:${note.id}`,
      left: toPercent(note.position, 0, arrangementEndTick.value),
      startTick: note.position,
    }));
};
const createPhraseLyrics = (
  trackId: TrackId,
  notes: Note[],
): PhraseLyricMarker[] => {
  const phraseLyrics = [...store.state.phrases.entries()]
    .filter(
      ([, phrase]) => phrase.trackId === trackId && phrase.notes.length > 0,
    )
    .sort(([, a], [, b]) => getStartTicksOfPhrase(a) - getStartTicksOfPhrase(b))
    .map(([phraseKey, phrase]) => {
      const startTicks = getStartTicksOfPhrase(phrase);
      const endTicks = getEndTicksOfPhrase(phrase);
      return {
        id: `phrase:${String(phraseKey)}`,
        left: toPercent(startTicks, 0, arrangementEndTick.value),
        width: Math.max(
          toPercent(endTicks, 0, arrangementEndTick.value) -
            toPercent(startTicks, 0, arrangementEndTick.value),
          0.8,
        ),
        startTick: startTicks,
        text: phrase.notes.map(getLyricForNote).join(""),
      };
    });

  if (phraseLyrics.length > 0 || notes.length === 0) return phraseLyrics;

  const startTicks = Math.min(...notes.map((note) => note.position));
  const endTicks = Math.max(
    ...notes.map((note) => note.position + note.duration),
  );
  return [
    {
      id: `track:${trackId}:lyrics`,
      left: toPercent(startTicks, 0, arrangementEndTick.value),
      width: Math.max(
        toPercent(endTicks, 0, arrangementEndTick.value) -
          toPercent(startTicks, 0, arrangementEndTick.value),
        0.8,
      ),
      startTick: startTicks,
      text: notes.map(getLyricForNote).join(""),
    },
  ];
};
const getTrackCharacter = (trackId: TrackId) => {
  const track = tracks.value.get(trackId);
  if (!track?.singer) return undefined;

  const characterInfos =
    store.state.characterInfos[track.singer.engineId] ?? [];
  for (const character of characterInfos) {
    for (const style of character.metas.styles) {
      if (style.styleId === track.singer.styleId) {
        return {
          singerName: character.metas.speakerName,
          style,
        };
      }
    }
  }
  return undefined;
};
const getMultitrackSingingTeacherLabel = (trackId: TrackId) =>
  multitrackSingingTeacherLabels.value[trackId] ?? singingTeacherLabel.value;
const getArrangementSingerStatusLabel = ({
  singerName,
  singingTeacher,
  keyRangeAdjustment,
  volumeRangeAdjustment,
}: {
  singerName: string;
  singingTeacher: string;
  keyRangeAdjustment: number;
  volumeRangeAdjustment: number;
}) =>
  `${singerName} / ${singingTeacher} / 音域 ${keyRangeAdjustment} 声量 ${volumeRangeAdjustment}`;
const getGainLabel = (gain: number) => `${Math.round(gain * 100)}%`;
const getPanLabel = (pan: number) => {
  const panAmount = Math.round(Math.abs(pan) * 100);
  if (panAmount === 0) return "C";
  return `${pan < 0 ? "L" : "R"}${panAmount}`;
};
const isMultitrackControlActive = (
  row: ArrangementRow,
  target: MultitrackControlTarget,
) =>
  activeMultitrackControl.value?.rowId === row.id &&
  activeMultitrackControl.value.target === target;
const getActiveMultitrackControlValue = (
  row: ArrangementRow,
  target: MultitrackControlTarget,
) =>
  isMultitrackControlActive(row, target)
    ? activeMultitrackControl.value?.value
    : undefined;
const getMultitrackGainDisplayLabel = (row: ArrangementRow) =>
  getGainLabel(getActiveMultitrackControlValue(row, "gain") ?? row.gain);
const getMultitrackPanDisplayLabel = (row: ArrangementRow) =>
  getPanLabel(getActiveMultitrackControlValue(row, "pan") ?? row.pan);
const clearMultitrackControl = (
  row: ArrangementRow,
  target: MultitrackControlTarget,
) => {
  if (isMultitrackControlActive(row, target)) {
    activeMultitrackControl.value = undefined;
  }
};
const getNumberFromValueOrEvent = (valueOrEvent: number | Event) =>
  typeof valueOrEvent === "number"
    ? valueOrEvent
    : valueOrEvent.target instanceof HTMLInputElement
      ? Number(valueOrEvent.target.value)
      : undefined;
const previewMultitrackControl = (
  row: ArrangementRow,
  target: MultitrackControlTarget,
  valueOrEvent: number | Event,
) => {
  const value = getNumberFromValueOrEvent(valueOrEvent);
  if (value == undefined) return;

  activeMultitrackControl.value = {
    rowId: row.id,
    target,
    value,
  };
};
const arrangementRows = computed<ArrangementRow[]>(() => {
  const trackRows = trackOrder.value.flatMap((trackId, trackIndex) => {
    const track = tracks.value.get(trackId);
    if (!track) return [];
    const character = getTrackCharacter(trackId);
    const errorNoteIds = getErrorNoteIdsForTrack(trackId);
    const errorMarkers = createErrorMarkers(track.notes, errorNoteIds);
    const isSelected =
      trackId === selectedTrackId.value &&
      audioAlignment.value.selectedClipId == undefined;
    const singerName = character?.singerName ?? "未設定";
    const singingTeacher = getMultitrackSingingTeacherLabel(trackId);

    return [
      {
        id: `track:${trackId}`,
        kind: "singer" as const,
        trackId,
        name: track.name || `Track ${trackIndex + 1}`,
        isNameEditing: editingTrackNameId.value === trackId,
        singerName,
        singingTeacherLabel: singingTeacher,
        characterStyle: character?.style,
        statusLabel: getArrangementSingerStatusLabel({
          singerName,
          singingTeacher,
          keyRangeAdjustment: track.keyRangeAdjustment,
          volumeRangeAdjustment: track.volumeRangeAdjustment,
        }),
        isSelected,
        isSolo: track.solo,
        isMuted: track.mute,
        gain: track.gain,
        pan: track.pan,
        panLabel: getPanLabel(track.pan),
        shouldPlay: playableTrackIds.value.has(trackId),
        keyRangeAdjustment: track.keyRangeAdjustment,
        volumeRangeAdjustment: track.volumeRangeAdjustment,
        phraseLyrics: createPhraseLyrics(trackId, track.notes),
        errorMarkers,
        errorCount: errorMarkers.length,
        notes: createPreviewNotes(track.notes, {
          errorNoteIds,
          noteNumberRange: isSelected
            ? getMinimapNoteNumberRange(track.notes)
            : undefined,
          topOffset: isSelected
            ? ARRANGEMENT_NOTE_TOP_OFFSET_SELECTED
            : ARRANGEMENT_NOTE_TOP_OFFSET_COMPACT,
          verticalRange: isSelected
            ? ARRANGEMENT_NOTE_VERTICAL_RANGE_SELECTED
            : ARRANGEMENT_NOTE_VERTICAL_RANGE_COMPACT,
        }),
        clips: [],
      },
    ];
  });

  return [
    ...trackRows,
    {
      id: MOCK_AUDIO_TRACK_ID,
      kind: "audio" as const,
      name: "Audio Ref",
      isNameEditing: false,
      singerName: "",
      singingTeacherLabel: "",
      statusLabel: `オフセット ${audioAlignmentOffsetLabel.value} / 粗 ${audioAlignment.value.coarseMeasureOffset}小節`,
      isSelected: audioAlignment.value.selectedClipId === MOCK_AUDIO_CLIP_ID,
      isSolo: false,
      isMuted: false,
      gain: 1,
      pan: 0,
      panLabel: "C",
      shouldPlay: true,
      keyRangeAdjustment: 0,
      volumeRangeAdjustment: 0,
      phraseLyrics: [],
      errorMarkers: [],
      errorCount: 0,
      notes: [],
      clips: [
        {
          id: MOCK_AUDIO_CLIP_ID,
          left: audioClipLeftPercent.value,
          width: MOCK_AUDIO_CLIP_WIDTH_PERCENT,
          peaks: MOCK_AUDIO_PEAKS,
        },
      ],
    },
  ];
});
const visibleArrangementRows = computed<ArrangementRow[]>(() => {
  if (arrangementDisclosureMode.value === "expanded") {
    return arrangementRows.value;
  }

  const selectedRow = arrangementRows.value.find((row) => row.isSelected);
  const firstSingerRow = arrangementRows.value.find(
    (row) => row.kind === "singer",
  );
  const focusedRow = selectedRow ?? firstSingerRow;
  return focusedRow == undefined ? [] : [focusedRow];
});
const selectArrangementRow = (row: ArrangementRow) => {
  if (row.kind === "audio") {
    audioAlignment.value = {
      ...audioAlignment.value,
      selectedClipId: MOCK_AUDIO_CLIP_ID,
    };
    return;
  }

  if (row.trackId == undefined) return;

  audioAlignment.value = {
    ...audioAlignment.value,
    selectedClipId: undefined,
  };
  void store.actions.SELECT_TRACK({ trackId: row.trackId });
};
const blurCurrentInput = (event: Event) => {
  if (event.target instanceof HTMLInputElement) {
    event.target.blur();
  }
};
const startMultitrackTrackNameEdit = (row: ArrangementRow) => {
  if (uiLocked.value || row.trackId == undefined) return;

  editingTrackNameId.value = row.trackId;
  void nextTick(() => {
    document
      .querySelector<HTMLInputElement>(".sing-multitrack-track-name-input")
      ?.select();
  });
};
const cancelMultitrackTrackNameEdit = () => {
  editingTrackNameId.value = undefined;
};
const addTrackAfter = async (trackId: TrackId) => {
  const willNextSelectedTrackIndex = trackOrder.value.indexOf(trackId) + 1;
  await store.actions.COMMAND_INSERT_EMPTY_TRACK({ prevTrackId: trackId });
  await store.actions.SELECT_TRACK({
    trackId: trackOrder.value[willNextSelectedTrackIndex],
  });
};
const addTrackAfterSelected = () => {
  void addTrackAfter(selectedTrackId.value);
};
const deleteTrack = async (trackId: TrackId) => {
  if (tracks.value.size <= 1) return;

  let willNextSelectedTrackIndex: number | undefined = undefined;
  if (selectedTrackId.value === trackId) {
    willNextSelectedTrackIndex = trackOrder.value.indexOf(trackId) - 1;
    if (willNextSelectedTrackIndex < 0) {
      willNextSelectedTrackIndex = 0;
    }
  }

  await store.actions.COMMAND_DELETE_TRACK({ trackId });
  if (willNextSelectedTrackIndex != undefined) {
    await store.actions.SELECT_TRACK({
      trackId: trackOrder.value[willNextSelectedTrackIndex],
    });
  }
};
const deleteTrackFromRow = (row: ArrangementRow) => {
  if (row.trackId == undefined) return;

  void deleteTrack(row.trackId);
};
const finishMultitrackTrackNameEdit = (row: ArrangementRow, event: Event) => {
  editingTrackNameId.value = undefined;
  if (row.trackId == undefined || !(event.target instanceof HTMLInputElement)) {
    return;
  }

  const name = event.target.value.trim();
  if (name === "" || name === row.name) {
    event.target.value = row.name;
    return;
  }

  void store.actions.COMMAND_SET_TRACK_NAME({ trackId: row.trackId, name });
};
const setMultitrackTrackGain = (
  row: ArrangementRow,
  valueOrEvent: number | Event,
) => {
  if (row.trackId == undefined) return;

  const gain = getNumberFromValueOrEvent(valueOrEvent);
  if (gain == undefined) return;

  if (store.state.undoableTrackOperations.panAndGain) {
    void store.actions.COMMAND_SET_TRACK_GAIN({ trackId: row.trackId, gain });
  } else {
    void store.actions.SET_TRACK_GAIN({ trackId: row.trackId, gain });
  }
};
const previewMultitrackTrackGain = (
  row: ArrangementRow,
  valueOrEvent: number | Event,
) => {
  previewMultitrackControl(row, "gain", valueOrEvent);
};
const commitMultitrackTrackGain = (
  row: ArrangementRow,
  valueOrEvent: number | Event,
) => {
  setMultitrackTrackGain(row, valueOrEvent);
  clearMultitrackControl(row, "gain");
};
const setMultitrackTrackPan = (
  row: ArrangementRow,
  valueOrEvent: number | Event,
) => {
  if (row.trackId == undefined) return;

  const pan = getNumberFromValueOrEvent(valueOrEvent);
  if (pan == undefined) return;

  if (store.state.undoableTrackOperations.panAndGain) {
    void store.actions.COMMAND_SET_TRACK_PAN({ trackId: row.trackId, pan });
  } else {
    void store.actions.SET_TRACK_PAN({ trackId: row.trackId, pan });
  }
};
const previewMultitrackTrackPan = (
  row: ArrangementRow,
  valueOrEvent: number | Event,
) => {
  previewMultitrackControl(row, "pan", valueOrEvent);
};
const commitMultitrackTrackPan = (
  row: ArrangementRow,
  valueOrEvent: number | Event,
) => {
  setMultitrackTrackPan(row, valueOrEvent);
  clearMultitrackControl(row, "pan");
};
const setMultitrackTrackMute = (row: ArrangementRow, mute: boolean) => {
  if (row.trackId == undefined) return;

  if (store.state.undoableTrackOperations.soloAndMute) {
    void store.actions.COMMAND_SET_TRACK_MUTE({ trackId: row.trackId, mute });
  } else {
    void store.actions.SET_TRACK_MUTE({ trackId: row.trackId, mute });
  }
};
const setMultitrackTrackSolo = (row: ArrangementRow, solo: boolean) => {
  if (row.trackId == undefined) return;

  if (store.state.undoableTrackOperations.soloAndMute) {
    void store.actions.COMMAND_SET_TRACK_SOLO({ trackId: row.trackId, solo });
  } else {
    void store.actions.SET_TRACK_SOLO({ trackId: row.trackId, solo });
  }
};
const muteAllTracks = () => {
  for (const trackId of trackOrder.value) {
    const track = tracks.value.get(trackId);
    if (track == undefined || track.mute) continue;

    if (store.state.undoableTrackOperations.soloAndMute) {
      void store.actions.COMMAND_SET_TRACK_MUTE({ trackId, mute: true });
    } else {
      void store.actions.SET_TRACK_MUTE({ trackId, mute: true });
    }
  }
};
const setMultitrackSingingTeacher = (row: ArrangementRow, event: Event) => {
  if (
    row.trackId == undefined ||
    !(event.target instanceof HTMLSelectElement)
  ) {
    return;
  }

  multitrackSingingTeacherLabels.value = {
    ...multitrackSingingTeacherLabels.value,
    [row.trackId]: event.target.value,
  };
};
const setMultitrackKeyRangeAdjustment = (row: ArrangementRow, event: Event) => {
  if (row.trackId == undefined || !(event.target instanceof HTMLInputElement)) {
    return;
  }

  const keyRangeAdjustment = Number(event.target.value);
  if (!isValidKeyRangeAdjustment(keyRangeAdjustment)) {
    event.target.value = String(row.keyRangeAdjustment);
    return;
  }

  void store.actions.COMMAND_SET_KEY_RANGE_ADJUSTMENT({
    keyRangeAdjustment,
    trackId: row.trackId,
  });
};
const setMultitrackVolumeRangeAdjustment = (
  row: ArrangementRow,
  event: Event,
) => {
  if (row.trackId == undefined || !(event.target instanceof HTMLInputElement)) {
    return;
  }

  const volumeRangeAdjustment = Number(event.target.value);
  if (!isValidVolumeRangeAdjustment(volumeRangeAdjustment)) {
    event.target.value = String(row.volumeRangeAdjustment);
    return;
  }

  void store.actions.COMMAND_SET_VOLUME_RANGE_ADJUSTMENT({
    volumeRangeAdjustment,
    trackId: row.trackId,
  });
};
const jumpToTick = (tick: number) => {
  void store.actions.SET_PLAYHEAD_POSITION({ position: tick });
  navigateSequencerToRatio(tick / arrangementEndTick.value);
};
const jumpToFirstTrackError = (row: ArrangementRow) => {
  const firstErrorMarker = row.errorMarkers[0];
  if (firstErrorMarker == undefined) return;

  jumpToTick(firstErrorMarker.startTick);
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
  box-sizing: border-box;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container) 42%,
    var(--scheme-color-surface-container-highest)
  );
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-height: var(--sing-collapsed-arrangement-height);
  padding: 0;
  width: 100%;
  border-bottom: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 54%, transparent);
  letter-spacing: 0.01em;

  &.mode-expanded {
    min-height: var(--sing-multitrack-arrangement-height);
  }
}

.sing-track-lane {
  align-items: stretch;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  position: relative;
  width: 100%;

  .sing-toolbar.arrangement-mode-right & {
    grid-template-columns: minmax(0, 1fr) 56px;
  }
}

.sing-arrangement-mode-column {
  box-sizing: border-box;
  grid-row: 1;
  grid-column: 1;
  display: grid;
  min-height: var(--sing-collapsed-arrangement-height);
  padding-top: 8px;
  border: 0;
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 50%, transparent);
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-low) 74%,
    transparent
  );
  justify-items: center;
  align-items: start;

  .mode-expanded & {
    min-height: var(--sing-multitrack-arrangement-height);
  }

  .sing-toolbar.arrangement-mode-right & {
    grid-column: 2;
    border-right: 0;
    border-left: 1px solid
      color-mix(in oklch, var(--scheme-color-outline-variant) 50%, transparent);
  }
}

.sing-arrangement-toggle-button {
  appearance: none;
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--scheme-color-on-surface-variant);
  cursor: pointer;
  font: inherit;
  outline: none;
  place-items: center;

  &:hover {
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container-highest) 68%,
      transparent
    );
    color: var(--scheme-color-on-surface);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--scheme-color-primary-container);
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

.sing-track-strip {
  position: relative;
  grid-row: 1;
  grid-column: 2;
  display: flex;
  align-items: stretch;
  min-width: 0;
  min-height: 0;
  height: var(--sing-collapsed-arrangement-height);
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 38%, transparent);
  border-left: 0;
  border-radius: 0;
  background: var(--scheme-color-surface-container-highest);
  overflow: hidden;

  &.mode-expanded {
    height: var(--sing-multitrack-arrangement-height);
  }

  .sing-toolbar.arrangement-mode-right & {
    grid-column: 1;
    border-right: 0;
    border-left: 1px solid
      color-mix(in oklch, var(--scheme-color-outline-variant) 38%, transparent);
    border-radius: 0;
  }
}

.sing-multitrack-resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 9;
  height: 8px;
  cursor: ns-resize;

  &::after {
    position: absolute;
    right: 12px;
    bottom: 2px;
    left: 12px;
    height: 2px;
    border-radius: 999px;
    background: transparent;
    content: "";
  }

  &:hover::after {
    background: color-mix(
      in oklch,
      var(--scheme-color-on-surface-variant) 28%,
      transparent
    );
  }
}

.sing-multitrack-header-column {
  position: relative;
  display: flex;
  flex: 0 0 320px;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 34%, transparent);
  background: var(--scheme-color-surface-container);
  overflow: hidden;
}

.sing-multitrack-header-scroll {
  flex: 1 1 auto;
  min-height: 0;
  padding-bottom: 32px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .sing-multitrack-header-column.collapsed & {
    padding-bottom: 0;
    overflow-y: hidden;
  }
}

.sing-multitrack-footer-row {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 4px 8px;
  border-top: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 28%, transparent);
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container) 88%,
    var(--scheme-color-surface-container-low)
  );
}

.sing-multitrack-add-button,
.sing-multitrack-footer-icon-button {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--scheme-color-on-surface-variant);
  cursor: pointer;
  outline: none;
}

.sing-multitrack-add-button {
  min-width: 0;
  color: var(--scheme-color-on-surface);
}

.sing-multitrack-add-button:hover:not(:disabled),
.sing-multitrack-footer-icon-button:hover:not(:disabled) {
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-highest) 72%,
    transparent
  );
  color: var(--scheme-color-on-surface);
}

.sing-multitrack-add-button:focus-visible,
.sing-multitrack-footer-icon-button:focus-visible {
  box-shadow: 0 0 0 2px var(--scheme-color-primary-container);
}

.sing-multitrack-add-button:disabled,
.sing-multitrack-footer-icon-button:disabled {
  color: color-mix(
    in oklch,
    var(--scheme-color-on-surface-variant) 34%,
    transparent
  );
  cursor: default;
}

.sing-multitrack-add-button,
.sing-multitrack-footer-icon-button {
  .material-symbols-rounded {
    display: block;
    font-size: 17px;
    font-variation-settings:
      "FILL" 1,
      "wght" 500,
      "GRAD" 0,
      "opsz" 20;
    line-height: 1;
  }
}

.sing-multitrack-add-button,
.sing-multitrack-footer-icon-button {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}

.sing-multitrack-header-row {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 72px;
  align-items: start;
  gap: 8px;
  min-width: 0;
  height: 44px;
  padding: 6px 8px;
  border-bottom: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 24%, transparent);
  background: transparent;
  color: var(--scheme-color-on-surface-variant);
  cursor: pointer;
  text-align: left;

  &:hover {
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container) 72%,
      transparent
    );
  }

  &.inactive {
    .sing-multitrack-avatar,
    .sing-multitrack-header-main {
      opacity: 0.54;
    }
  }

  &.selected {
    height: 72px;
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container-highest) 88%,
      var(--scheme-color-secondary-container)
    );
    color: var(--scheme-color-on-surface);
    box-shadow: inset 3px 0 0 var(--scheme-color-secondary);
  }

  &:not(.selected) {
    grid-template-columns: 32px minmax(0, 1fr) 52px;

    .sing-multitrack-header-main {
      grid-template-rows: 18px 14px;
    }

    .sing-multitrack-mix-row {
      display: none;
    }

    .sing-multitrack-actions {
      grid-template-columns: repeat(3, 20px);
    }

    .sing-multitrack-more-button {
      display: none;
    }
  }

  &.audio {
    color: color-mix(
      in oklch,
      var(--scheme-color-on-surface-variant) 88%,
      var(--scheme-color-secondary)
    );
  }

  &.audio.selected {
    grid-template-columns: 32px minmax(0, 1fr) 28px;

    .sing-multitrack-header-main {
      grid-template-rows: 18px 14px 24px;
    }
  }

  .material-symbols-rounded {
    display: block;
    font-size: 18px;
    font-variation-settings:
      "FILL" 1,
      "wght" 500,
      "GRAD" 0,
      "opsz" 20;
    line-height: 1;
  }
}

.sing-multitrack-avatar {
  position: relative;
  display: grid;
  width: 32px;
  height: 32px;
  color: var(--scheme-color-on-surface-variant);
  place-items: center;

  :deep(.q-avatar) {
    width: 28px;
    height: 28px;
  }
}

.sing-multitrack-avatar-placeholder {
  display: grid;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--scheme-color-secondary-container);
  color: var(--scheme-color-on-secondary-container);
  font-size: 13px;
  font-weight: 600;
  place-items: center;
}

.sing-multitrack-header-main {
  display: grid;
  grid-template-rows: 18px 14px 16px;
  align-self: stretch;
  min-width: 0;
}

.sing-multitrack-track-name-input,
.sing-multitrack-track-name,
.sing-multitrack-track-status {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sing-multitrack-track-name,
.sing-multitrack-track-name-input {
  color: var(--scheme-color-on-surface);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.sing-multitrack-track-name {
  appearance: none;
  min-width: 0;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  cursor: text;
  font: inherit;
  text-align: left;

  &:hover:not(:disabled) {
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container) 72%,
      transparent
    );
  }

  &:disabled {
    cursor: default;
  }
}

.sing-multitrack-track-name-input {
  appearance: none;
  min-width: 0;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--scheme-color-on-surface);
  font: inherit;
  outline: none;

  &:hover:not(:disabled),
  &:focus {
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container) 72%,
      transparent
    );
  }

  &:disabled {
    color: var(--scheme-color-on-surface-variant);
  }
}

.sing-multitrack-track-status {
  color: var(--scheme-color-on-surface-variant);
  font-size: 10px;
  font-weight: 400;
  line-height: 14px;
}

.sing-audio-alignment-row {
  display: grid;
  grid-template-columns: 72px minmax(68px, 1fr) 42px;
  align-items: center;
  gap: 5px;
  min-width: 0;
  height: 24px;
}

.sing-audio-offset-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px;
  height: 22px;
  padding: 0 5px;
  border-radius: 4px;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container) 72%,
    transparent
  );
  color: var(--scheme-color-on-surface-variant);
  font-size: 9px;
  line-height: 1;

  input {
    appearance: textfield;
    min-width: 0;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--scheme-color-on-surface);
    font: inherit;
    font-size: 10px;
    font-weight: 600;
    outline: none;
    text-align: right;
  }
}

.sing-audio-nudge-group {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2px;
  min-width: 0;
}

.sing-audio-nudge-button {
  appearance: none;
  height: 22px;
  min-width: 0;
  padding: 0 2px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: color-mix(
    in oklch,
    var(--scheme-color-on-surface-variant) 78%,
    var(--scheme-color-secondary)
  );
  cursor: pointer;
  font-family: inherit;
  font-size: 9px;
  font-weight: 600;

  &:hover {
    background: color-mix(
      in oklch,
      var(--scheme-color-secondary-container) 40%,
      transparent
    );
    color: var(--scheme-color-on-surface);
  }
}

.sing-audio-snap-toggle {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  align-items: center;
  gap: 3px;
  height: 22px;
  color: var(--scheme-color-on-surface-variant);
  font-size: 9px;
  font-weight: 600;
  line-height: 1;

  input {
    width: 10px;
    height: 10px;
    margin: 0;
    accent-color: var(--scheme-color-secondary);
  }
}

.sing-multitrack-mix-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 16px;
}

.sing-multitrack-gain {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  align-items: center;
  gap: 4px;
  min-width: 0;
  height: 16px;

  .material-symbols-rounded {
    color: var(--scheme-color-on-surface-variant);
    font-size: 14px;
    font-variation-settings:
      "FILL" 1,
      "wght" 500,
      "GRAD" 0,
      "opsz" 20;
    line-height: 1;
  }
}

.sing-multitrack-pan {
  position: relative;
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) 8px;
  align-items: center;
  gap: 4px;
  min-width: 0;
  height: 16px;
}

.sing-multitrack-pan-side {
  color: color-mix(
    in oklch,
    var(--scheme-color-on-surface-variant) 64%,
    transparent
  );
  font-size: 8px;
  font-weight: 600;
  line-height: 1;
  text-align: center;
}

.sing-multitrack-gain-slider,
.sing-multitrack-pan-slider {
  appearance: none;
  width: 100%;
  height: 16px;
  margin: 0;
  background: transparent;
  cursor: pointer;

  &::-webkit-slider-runnable-track {
    height: 2px;
    border-radius: 999px;
    background: color-mix(
      in oklch,
      var(--scheme-color-secondary) 66%,
      transparent
    );
  }

  &::-webkit-slider-thumb {
    appearance: none;
    width: 8px;
    height: 8px;
    margin-top: -3px;
    border: 0;
    border-radius: 50%;
    background: color-mix(
      in oklch,
      var(--scheme-color-secondary) 72%,
      var(--scheme-color-on-surface)
    );
  }

  &::-moz-range-track {
    height: 2px;
    border-radius: 999px;
    background: color-mix(
      in oklch,
      var(--scheme-color-secondary) 66%,
      transparent
    );
  }

  &::-moz-range-thumb {
    width: 8px;
    height: 8px;
    border: 0;
    border-radius: 50%;
    background: color-mix(
      in oklch,
      var(--scheme-color-secondary) 72%,
      var(--scheme-color-on-surface)
    );
  }
}

.sing-multitrack-pan-slider {
  &::-webkit-slider-runnable-track {
    background:
      linear-gradient(
        90deg,
        transparent 0,
        transparent calc(50% - 1px),
        color-mix(
            in oklch,
            var(--scheme-color-on-surface-variant) 22%,
            transparent
          )
          calc(50% - 1px),
        color-mix(
            in oklch,
            var(--scheme-color-on-surface-variant) 22%,
            transparent
          )
          calc(50% + 1px),
        transparent calc(50% + 1px),
        transparent 100%
      ),
      color-mix(in oklch, var(--scheme-color-outline) 36%, transparent);
  }

  &::-moz-range-track {
    background:
      linear-gradient(
        90deg,
        transparent 0,
        transparent calc(50% - 1px),
        color-mix(
            in oklch,
            var(--scheme-color-on-surface-variant) 22%,
            transparent
          )
          calc(50% - 1px),
        color-mix(
            in oklch,
            var(--scheme-color-on-surface-variant) 22%,
            transparent
          )
          calc(50% + 1px),
        transparent calc(50% + 1px),
        transparent 100%
      ),
      color-mix(in oklch, var(--scheme-color-outline) 36%, transparent);
  }
}

.sing-multitrack-control-value {
  position: absolute;
  right: 0;
  bottom: calc(100% + 3px);
  z-index: 2;
  min-width: 30px;
  padding: 2px 4px;
  border-radius: 4px;
  background: color-mix(
    in oklch,
    var(--scheme-color-inverse-surface) 88%,
    transparent
  );
  color: var(--scheme-color-inverse-on-surface);
  font-size: 9px;
  font-weight: 600;
  line-height: 12px;
  opacity: 0;
  pointer-events: none;
  text-align: center;
  transform: translateY(2px);
  transition:
    opacity 80ms ease,
    transform 80ms ease;
  white-space: nowrap;
}

.sing-multitrack-gain:hover .sing-multitrack-control-value,
.sing-multitrack-gain:focus-within .sing-multitrack-control-value,
.sing-multitrack-gain.active .sing-multitrack-control-value,
.sing-multitrack-pan:hover .sing-multitrack-control-value,
.sing-multitrack-pan:focus-within .sing-multitrack-control-value,
.sing-multitrack-pan.active .sing-multitrack-control-value {
  opacity: 1;
  transform: translateY(0);
}

.sing-multitrack-actions {
  display: grid;
  grid-template-columns: repeat(4, 20px);
  align-self: start;
  gap: 4px;
  justify-content: end;
}

.sing-multitrack-actions.audio-actions {
  grid-template-columns: 20px;
  justify-self: end;
}

.sing-multitrack-state-button,
.sing-multitrack-more-button,
.sing-multitrack-error-badge,
.sing-track-error-badge {
  appearance: none;
  display: grid;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--scheme-color-on-surface-variant);
  cursor: pointer;
  font-size: 9px;
  font-weight: 600;
  line-height: 20px;
  outline: none;
  place-items: center;

  &:hover:not(:disabled) {
    background: var(--scheme-color-surface-container);
    color: var(--scheme-color-on-surface);
  }

  &:disabled {
    color: color-mix(
      in oklch,
      var(--scheme-color-on-surface-variant) 34%,
      transparent
    );
    cursor: default;
  }

  &.active {
    background: var(--scheme-color-secondary-container);
    color: var(--scheme-color-on-secondary-container);
  }

  .material-symbols-rounded {
    display: block;
    font-size: 16px;
    font-variation-settings:
      "FILL" 1,
      "wght" 500,
      "GRAD" 0,
      "opsz" 20;
    line-height: 1;
  }
}

.sing-multitrack-error-badge,
.sing-track-error-badge {
  background: color-mix(
    in oklch,
    var(--scheme-color-error-container) 88%,
    var(--scheme-color-error)
  );
  color: var(--scheme-color-on-error-container);
  font-size: 10px;
  font-weight: 800;

  &:hover:not(:disabled) {
    background: var(--scheme-color-error);
    color: var(--scheme-color-on-error);
  }
}

.sing-track-error-badge {
  align-self: center;
  margin: 0 8px 0 -2px;
}

:global(.sing-multitrack-menu) {
  border-radius: 8px;
  box-shadow: 0 10px 28px
    color-mix(in oklch, var(--scheme-color-shadow) 14%, transparent);
}

:global(.sing-multitrack-menu-content) {
  display: grid;
  gap: 6px;
  min-width: 190px;
  padding: 8px;
}

:global(.sing-multitrack-menu-command) {
  appearance: none;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--scheme-color-on-surface);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 24px;
  padding: 0 8px;
  text-align: left;

  &:hover:not(:disabled) {
    background: var(--scheme-color-surface-container);
  }

  &:disabled {
    color: color-mix(
      in oklch,
      var(--scheme-color-on-surface-variant) 34%,
      transparent
    );
    cursor: default;
  }

  &.danger {
    margin-top: 4px;
    color: var(--scheme-color-error);

    &:hover:not(:disabled) {
      background: color-mix(
        in oklch,
        var(--scheme-color-error-container) 72%,
        transparent
      );
      color: var(--scheme-color-on-error-container);
    }
  }
}

:global(.sing-multitrack-menu-row) {
  align-items: baseline;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  color: var(--scheme-color-on-surface-variant);
  font-size: 11px;
  line-height: 18px;
  padding: 2px 4px;
}

:global(.sing-multitrack-menu-control) {
  appearance: none;
  min-width: 0;
  width: 100%;
  padding: 3px 6px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 68%, transparent);
  border-radius: 4px;
  background: var(--scheme-color-surface-container-highest);
  color: var(--scheme-color-on-surface);
  font: inherit;
  font-size: 11px;
  font-weight: 500;

  &.number {
    appearance: textfield;
    text-align: right;
  }
}

.sing-singer-map {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
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
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  min-width: 0;
  min-height: 0;
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
  grid-row: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.sing-multitrack-sequencer-window {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  min-width: 8px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-secondary) 48%, transparent);
  background: color-mix(
    in oklch,
    var(--scheme-color-secondary-container) 8%,
    transparent
  );
  cursor: grab;
  pointer-events: auto;
}

.sing-multitrack-sequencer-window {
  z-index: 4;
  border-top: 0;
  border-bottom: 0;
}

.sing-multitrack-map-scroll {
  position: relative;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: color-mix(
      in oklch,
      var(--scheme-color-outline-variant) 42%,
      transparent
    )
    transparent;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 999px;
    background: color-mix(
      in oklch,
      var(--scheme-color-outline-variant) 42%,
      transparent
    );
    background-clip: content-box;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &.collapsed {
    overflow-y: hidden;
    scrollbar-width: none;
  }

  &.collapsed::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
}

.sing-multitrack-content {
  appearance: none;
  position: relative;
  display: block;
  min-height: 100%;
  padding: 0;
  border: 0;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container) 82%,
    var(--scheme-color-surface-container-low)
  );
  color: inherit;
  cursor: pointer;
  font: inherit;
  outline: none;
  text-align: left;
  overflow: hidden;
  transform-origin: left top;

  &:focus-visible {
    outline: 2px solid var(--scheme-color-secondary);
    outline-offset: -2px;
  }

  .sing-multitrack-map-scroll.dragging & {
    cursor: grabbing;
  }
}

.sing-multitrack-grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image: repeating-linear-gradient(
    90deg,
    color-mix(in oklch, var(--scheme-color-outline-variant) 24%, transparent) 0,
    color-mix(in oklch, var(--scheme-color-outline-variant) 24%, transparent)
      1px,
    transparent 1px,
    transparent 48px
  );
  pointer-events: none;
}

.sing-multitrack-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 6;
  width: 2px;
  transform: translateX(-1px);
  background: var(--scheme-color-inverse-surface);
  pointer-events: none;
}

.sing-multitrack-error-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 6;
  width: 2px;
  transform: translateX(-1px);
  background: color-mix(in oklch, var(--scheme-color-error) 78%, transparent);
  pointer-events: none;
}

.sing-multitrack-error-marker {
  opacity: 0.58;
}

.sing-multitrack-map-row {
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  min-width: 0;
  height: 44px;
  border-bottom: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 24%, transparent);
  overflow: hidden;

  &.selected {
    height: 72px;
    background: color-mix(
      in oklch,
      var(--scheme-color-secondary-container) 12%,
      transparent
    );
  }

  &.audio {
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container-highest) 44%,
      transparent
    );
  }
}

.sing-multitrack-map-footer-spacer {
  height: 32px;
}

.sing-multitrack-phrase-lyric {
  appearance: none;
  position: absolute;
  top: 5px;
  z-index: 2;
  height: 14px;
  min-width: 18px;
  padding: 0 3px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--scheme-color-on-surface);
  cursor: pointer;
  font: inherit;
  font-size: 9px;
  font-weight: 600;
  line-height: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    background: color-mix(
      in oklch,
      var(--scheme-color-secondary-container) 40%,
      transparent
    );
  }
}

.sing-multitrack-note {
  position: absolute;
  z-index: 3;
  height: 3px;
  min-width: 3px;
  padding: 0;
  border-radius: 999px;
  background: color-mix(
    in oklch,
    var(--scheme-color-secondary) 54%,
    var(--scheme-color-surface-container-highest)
  );
  pointer-events: none;

  &.error {
    z-index: 5;
    background: color-mix(
      in oklch,
      var(--scheme-color-error) 78%,
      var(--scheme-color-error-container)
    );
    box-shadow: 0 0 0 1px
      color-mix(in oklch, var(--scheme-color-error) 42%, transparent);
  }
}

.sing-multitrack-audio-clip {
  position: absolute;
  top: 16px;
  bottom: 16px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 1px;
  min-width: 36px;
  padding: 0 28px 0 8px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 42%, transparent);
  border-radius: 4px;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-highest) 88%,
    var(--scheme-color-secondary-container)
  );
  cursor: grab;
  pointer-events: auto;

  &.dragging {
    cursor: grabbing;
    box-shadow: 0 0 0 1px
      color-mix(in oklch, var(--scheme-color-secondary) 54%, transparent);
  }

  &.selected {
    background: color-mix(
      in oklch,
      var(--scheme-color-secondary-container) 34%,
      var(--scheme-color-surface-container-highest)
    );
    box-shadow: 0 0 0 1px
      color-mix(in oklch, var(--scheme-color-secondary) 36%, transparent);
  }
}

.sing-multitrack-audio-head-handle {
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 5px;
  width: 2px;
  border-radius: 999px;
  background: color-mix(
    in oklch,
    var(--scheme-color-secondary) 68%,
    var(--scheme-color-on-surface-variant)
  );
  pointer-events: none;
}

.sing-multitrack-audio-peak {
  display: block;
  flex: 1 1 0;
  min-width: 1px;
  max-width: 3px;
  border-radius: 999px;
  background: color-mix(
    in oklch,
    var(--scheme-color-secondary) 44%,
    var(--scheme-color-on-surface-variant)
  );
  pointer-events: none;
}

.sing-multitrack-clip-menu-button {
  appearance: none;
  position: absolute;
  top: 50%;
  right: 4px;
  display: grid;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: color-mix(
    in oklch,
    var(--scheme-color-on-surface-variant) 72%,
    transparent
  );
  cursor: pointer;
  outline: none;
  place-items: center;
  transform: translateY(-50%);

  &:hover,
  &:focus-visible {
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container-highest) 80%,
      transparent
    );
    color: var(--scheme-color-on-surface);
  }

  .material-symbols-rounded {
    display: block;
    font-size: 17px;
    font-variation-settings:
      "FILL" 1,
      "wght" 500,
      "GRAD" 0,
      "opsz" 20;
    line-height: 1;
  }
}
</style>
