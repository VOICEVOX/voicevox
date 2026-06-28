<template>
  <QToolbar
    class="sing-toolbar"
    :class="[
      `mode-${arrangementViewMode}`,
      `arrangement-mode-${arrangementModeSide}`,
      { 'multitrack-resizing': isMultitrackResizing },
    ]"
    :style="arrangementToolbarStyle"
  >
    <div class="sing-track-lane">
      <div class="sing-arrangement-mode-column">
        <button
          class="sing-arrangement-toggle-button"
          :class="{ active: arrangementViewMode === 'multitrack' }"
          type="button"
          :aria-pressed="arrangementViewMode === 'multitrack'"
          :aria-label="
            arrangementViewMode === 'multitrack'
              ? 'マルチトラック表示を折りたたむ'
              : 'マルチトラック表示を展開'
          "
          :title="
            arrangementViewMode === 'multitrack'
              ? 'マルチトラック表示を折りたたむ'
              : 'マルチトラック表示を展開'
          "
          @click="toggleArrangementViewMode"
        >
          <span class="material-symbols-rounded" aria-hidden="true">
            {{
              arrangementViewMode === "multitrack"
                ? "expand_less"
                : "expand_more"
            }}
          </span>
        </button>
      </div>
      <div class="sing-track-strip" :class="`mode-${arrangementViewMode}`">
        <div v-if="arrangementViewMode === 'singer'" class="sing-track-header">
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
        <div v-else class="sing-multitrack-header-column">
          <div
            ref="multitrackHeaderScrollRef"
            class="sing-multitrack-header-scroll"
            @scroll="onMultitrackHeaderScroll"
          >
            <div
              v-for="row in multitrackRows"
              :key="row.id"
              class="sing-multitrack-header-row"
              :class="{
                selected: row.isSelected,
                audio: row.kind === 'audio',
                inactive: !row.shouldPlay,
              }"
              @click="selectMultitrackRow(row)"
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
                  {{ row.singerName || row.statusLabel }}
                </span>
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
                      >
                        クリップ追加
                      </button>
                      <button
                        v-close-popup
                        class="sing-multitrack-menu-command"
                        type="button"
                      >
                        トラック名を変更
                      </button>
                      <button
                        v-close-popup
                        class="sing-multitrack-menu-command"
                        type="button"
                      >
                        トラック削除
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
                  >
                    クリップ追加
                  </button>
                  <button
                    v-close-popup
                    class="sing-multitrack-menu-command"
                    type="button"
                  >
                    トラック名を変更
                  </button>
                  <button
                    v-close-popup
                    class="sing-multitrack-menu-command"
                    type="button"
                  >
                    トラック削除
                  </button>
                </div>
              </QMenu>
            </div>
          </div>
          <div class="sing-multitrack-footer-row" aria-label="トラック操作">
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
            :class="`mode-${arrangementViewMode}`"
            @wheel="onMinimapWheel"
          >
            <div ref="minimapViewportRef" class="sing-minimap-viewport">
              <div
                v-if="arrangementViewMode === 'singer'"
                class="sing-minimap-content"
                :class="{ dragging: isSingerMinimapNavigating }"
                role="button"
                tabindex="0"
                aria-label="ノートミニマップの位置へ移動"
                @pointerdown="onSingerMinimapPointerDown"
                @keydown.left.prevent="navigateSingerMinimapByKeyboard(-1)"
                @keydown.right.prevent="navigateSingerMinimapByKeyboard(1)"
              >
                <div
                  v-if="sequencerVisibleRange.width > 0"
                  class="sing-minimap-sequencer-window"
                  :style="{
                    left: `${sequencerVisibleRange.left}%`,
                    width: `${sequencerVisibleRange.width}%`,
                  }"
                ></div>
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
                  v-for="previewNote in minimapRegularNotes"
                  :key="previewNote.id"
                  class="sing-minimap-note"
                  :style="{
                    left: `${previewNote.left}%`,
                    width: `${previewNote.width}%`,
                    top: `${previewNote.top}%`,
                  }"
                ></div>
                <div
                  v-for="previewNote in minimapErrorNotes"
                  :key="previewNote.id"
                  class="sing-minimap-note error"
                  :style="{
                    left: `${previewNote.left}%`,
                    width: `${previewNote.width}%`,
                    top: `${previewNote.top}%`,
                  }"
                ></div>
              </div>
              <div
                v-else
                ref="multitrackMapScrollRef"
                class="sing-multitrack-map-scroll"
                @scroll="onMultitrackMapScroll"
              >
                <div
                  class="sing-multitrack-content"
                  role="button"
                  tabindex="0"
                  aria-label="マルチトラック概要の位置へ移動"
                  :style="{
                    width: minimapContentWidthStyle,
                    transform: minimapContentTransform,
                  }"
                  @click="setPlayheadFromMinimap"
                >
                  <div
                    class="sing-multitrack-playhead"
                    :style="{ left: `${minimapPlayheadPosition}%` }"
                  ></div>
                  <div class="sing-multitrack-grid"></div>
                  <div
                    v-for="row in multitrackRows"
                    :key="row.id"
                    class="sing-multitrack-map-row"
                    :class="{
                      selected: row.isSelected,
                      audio: row.kind === 'audio',
                    }"
                  >
                    <div
                      v-if="row.lyricSummary"
                      class="sing-multitrack-row-lyric"
                    >
                      {{ row.lyricSummary }}
                    </div>
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
                        :class="{ dragging: draggingAudioClipId === clip.id }"
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
                              >
                                クリップを分割
                              </button>
                              <button
                                v-close-popup
                                class="sing-multitrack-menu-command"
                                type="button"
                              >
                                クリップを複製
                              </button>
                              <button
                                v-close-popup
                                class="sing-multitrack-menu-command"
                                type="button"
                              >
                                クリップを削除
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
                            >
                              クリップを分割
                            </button>
                            <button
                              v-close-popup
                              class="sing-multitrack-menu-command"
                              type="button"
                            >
                              クリップを複製
                            </button>
                            <button
                              v-close-popup
                              class="sing-multitrack-menu-command"
                              type="button"
                            >
                              クリップを削除
                            </button>
                          </div>
                        </QMenu>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="arrangementViewMode === 'multitrack'"
              class="sing-minimap-controls"
            >
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
                    v-if="sequencerVisibleRange.width > 0"
                    class="sing-minimap-scrollbar-sequencer-window"
                    :style="{
                      left: `${sequencerVisibleRange.left}%`,
                      width: `${sequencerVisibleRange.width}%`,
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
        <div
          v-if="arrangementViewMode === 'multitrack'"
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
  shouldPlayTracks,
} from "@/sing/domain";
import { getTimeSignaturePositions, tickToMeasureNumber } from "@/sing/music";
import { getTotalTicks } from "@/sing/rulerHelper";
import { SEQUENCER_MIN_NUM_MEASURES } from "@/sing/viewHelper";
import CharacterSelectMenu from "@/components/Sing/CharacterMenuButton/CharacterSelectMenu.vue";
import CharacterMenuButton from "@/components/Sing/CharacterMenuButton/MenuButton.vue";
import SingerIcon from "@/components/Sing/SingerIcon.vue";
import type { Note } from "@/domain/project/type";
import type { StyleInfo, TrackId } from "@/type/preload";
import type { ToolPaletteLayout } from "@/components/Sing/toolPaletteLayout";
import type { SequencerViewportState } from "@/components/Sing/ScoreSequencer.vue";

const store = useStore();
const props = defineProps<{
  toolPaletteLayout: ToolPaletteLayout;
  sequencerViewport: SequencerViewportState;
}>();
const emit = defineEmits<{
  navigateSequencer: [scrollLeft: number];
}>();
const MINIMAP_QUARTER_NOTE_WIDTH = 12;
const MINIMAP_NOTE_LOW_NOTE_NUMBER = 48;
const MINIMAP_NOTE_HIGH_NOTE_NUMBER = 84;
const MINIMAP_NOTE_TOP_OFFSET = 31;
const MINIMAP_NOTE_VERTICAL_RANGE = 40;
const MINIMAP_NOTE_RANGE_PADDING = 2;
const MINIMAP_NOTE_RANGE_MIN_SEMITONES = 12;
const MINIMAP_ZOOM_MIN = 0.05;
const MINIMAP_ZOOM_MAX = 3;
const MINIMAP_ZOOM_STEP = 0.05;
const MULTITRACK_ARRANGEMENT_HEIGHT_MIN = 144;
const MULTITRACK_ARRANGEMENT_HEIGHT_MAX = 420;
const MULTITRACK_ARRANGEMENT_HEIGHT_DEFAULT = 184;
const MULTITRACK_NOTE_TOP_OFFSET = 24;
const MULTITRACK_NOTE_VERTICAL_RANGE = 48;
const MOCK_AUDIO_CLIP_WIDTH_PERCENT = 52;
const MOCK_AUDIO_PEAKS = [
  34, 56, 48, 71, 42, 62, 76, 54, 39, 68, 82, 57, 44, 73, 51, 64, 35, 59, 78,
  46, 69, 53, 41, 66,
];

type ArrangementViewMode = "singer" | "multitrack";

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

type MultitrackControlTarget = "gain" | "pan";

type MultitrackRow = {
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
  lyricSummary: string;
  notes: PreviewNote[];
  clips: PreviewAudioClip[];
};

const arrangementViewMode = ref<ArrangementViewMode>("singer");
const multitrackArrangementHeight = ref(MULTITRACK_ARRANGEMENT_HEIGHT_DEFAULT);
const isMultitrackResizing = ref(false);
const editingTrackNameId = ref<TrackId>();
const multitrackSingingTeacherLabels = ref<Record<string, string>>({});
const activeMultitrackControl = ref<{
  rowId: string;
  target: MultitrackControlTarget;
  value: number;
}>();
const mockAudioClipLeftPercent = ref(10);
const draggingAudioClipId = ref<string>();
let multitrackResizeStartY = 0;
let multitrackResizeStartHeight = MULTITRACK_ARRANGEMENT_HEIGHT_DEFAULT;
let audioClipDragStartClientX = 0;
let audioClipDragStartLeftPercent = 0;

const arrangementToolbarStyle = computed<Record<string, string>>(() => ({
  "--sing-multitrack-arrangement-height": `${multitrackArrangementHeight.value}px`,
}));
const arrangementModeSide = computed<"left" | "right">(() =>
  props.toolPaletteLayout === "sideRight" ? "right" : "left",
);
const toggleArrangementViewMode = () => {
  arrangementViewMode.value =
    arrangementViewMode.value === "multitrack" ? "singer" : "multitrack";
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
const setMockAudioClipLeftPercent = (left: number) => {
  mockAudioClipLeftPercent.value = Math.max(
    0,
    Math.min(left, 100 - MOCK_AUDIO_CLIP_WIDTH_PERCENT),
  );
};
const onMultitrackAudioClipDragPointerMove = (event: PointerEvent) => {
  event.preventDefault();
  const deltaPercent =
    ((event.clientX - audioClipDragStartClientX) /
      Math.max(minimapContentWidth.value, 1)) *
    100;
  setMockAudioClipLeftPercent(audioClipDragStartLeftPercent + deltaPercent);
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
  audioClipDragStartClientX = event.clientX;
  audioClipDragStartLeftPercent = clip.left;
  window.addEventListener("pointermove", onMultitrackAudioClipDragPointerMove);
  window.addEventListener("pointerup", stopMultitrackAudioClipDrag);
  window.addEventListener("pointercancel", stopMultitrackAudioClipDrag);
};

const keyRangeAdjustment = computed(
  () => store.getters.SELECTED_TRACK.keyRangeAdjustment,
);
const volumeRangeAdjustment = computed(
  () => store.getters.SELECTED_TRACK.volumeRangeAdjustment,
);
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
const minimapZoom = ref(1);
const minimapViewportRef = ref<HTMLElement>();
const minimapScrollbarRef = ref<HTMLElement>();
const multitrackHeaderScrollRef = ref<HTMLElement>();
const multitrackMapScrollRef = ref<HTMLElement>();
const minimapViewportWidth = ref(0);
const minimapScrollLeft = ref(0);
const isMinimapScrollbarDragging = ref(false);
const isSingerMinimapNavigating = ref(false);
let minimapResizeObserver: ResizeObserver | undefined;
let isSyncingMultitrackVerticalScroll = false;

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
const getSingerMinimapPointerRatio = (clientX: number) => {
  const minimapViewportElement = minimapViewportRef.value;
  if (minimapViewportElement == undefined) return 0;

  const rect = minimapViewportElement.getBoundingClientRect();
  return Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
};
const onSingerMinimapPointerMove = (event: PointerEvent) => {
  event.preventDefault();
  navigateSequencerToRatio(getSingerMinimapPointerRatio(event.clientX));
};
const stopSingerMinimapNavigation = () => {
  isSingerMinimapNavigating.value = false;
  window.removeEventListener("pointermove", onSingerMinimapPointerMove);
  window.removeEventListener("pointerup", stopSingerMinimapNavigation);
  window.removeEventListener("pointercancel", stopSingerMinimapNavigation);
};
const onSingerMinimapPointerDown = (event: PointerEvent) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  event.preventDefault();
  isSingerMinimapNavigating.value = true;
  navigateSequencerToRatio(getSingerMinimapPointerRatio(event.clientX));
  window.addEventListener("pointermove", onSingerMinimapPointerMove);
  window.addEventListener("pointerup", stopSingerMinimapNavigation);
  window.addEventListener("pointercancel", stopSingerMinimapNavigation);
};
const navigateSingerMinimapByKeyboard = (direction: -1 | 1) => {
  navigateSequencerToScrollLeft(
    props.sequencerViewport.scrollLeft +
      direction * Math.max(props.sequencerViewport.clientWidth * 0.8, 1),
  );
};
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
const syncMultitrackVerticalScroll = (
  source: HTMLElement,
  target: HTMLElement | undefined,
) => {
  if (target == undefined || isSyncingMultitrackVerticalScroll) return;

  isSyncingMultitrackVerticalScroll = true;
  const sourceScrollMax = Math.max(
    source.scrollHeight - source.clientHeight,
    0,
  );
  const targetScrollMax = Math.max(
    target.scrollHeight - target.clientHeight,
    0,
  );
  const scrollRatio =
    sourceScrollMax === 0 ? 0 : source.scrollTop / sourceScrollMax;
  target.scrollTop = targetScrollMax * scrollRatio;
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
const getWheelDeltaUnit = (event: WheelEvent) => {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return Math.max(minimapViewportWidth.value, 1);
  }
  return 1;
};
const onMinimapWheel = (event: WheelEvent) => {
  if (arrangementViewMode.value !== "multitrack") return;
  const targetElement =
    event.target instanceof Element ? event.target : undefined;
  const isOverMultitrackMap =
    targetElement?.closest(".sing-multitrack-map-scroll") != undefined;
  const shouldScrollVertically =
    isOverMultitrackMap &&
    !event.shiftKey &&
    Math.abs(event.deltaY) >= Math.abs(event.deltaX);
  if (shouldScrollVertically) return;

  if (minimapScrollMax.value === 0) return;

  const wheelDelta =
    event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)
      ? event.deltaY
      : event.deltaX;
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
  stopSingerMinimapNavigation();
  stopMinimapScrollbarDrag();
  stopMultitrackResize();
  stopMultitrackAudioClipDrag();
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
const selectedTrackMinimapNoteNumberRange = computed(() =>
  getMinimapNoteNumberRange(selectedTrack.value.notes),
);
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
const getLyricSummary = (notes: Note[]) => {
  const lyricSummary = notes.slice(0, 18).map(getLyricForNote).join("");
  return notes.length > 18 ? `${lyricSummary}…` : lyricSummary;
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
const getGainLabel = (gain: number) => `${Math.round(gain * 100)}%`;
const getPanLabel = (pan: number) => {
  const panAmount = Math.round(Math.abs(pan) * 100);
  if (panAmount === 0) return "C";
  return `${pan < 0 ? "L" : "R"}${panAmount}`;
};
const isMultitrackControlActive = (
  row: MultitrackRow,
  target: MultitrackControlTarget,
) =>
  activeMultitrackControl.value?.rowId === row.id &&
  activeMultitrackControl.value.target === target;
const getActiveMultitrackControlValue = (
  row: MultitrackRow,
  target: MultitrackControlTarget,
) =>
  isMultitrackControlActive(row, target)
    ? activeMultitrackControl.value?.value
    : undefined;
const getMultitrackGainDisplayLabel = (row: MultitrackRow) =>
  getGainLabel(getActiveMultitrackControlValue(row, "gain") ?? row.gain);
const getMultitrackPanDisplayLabel = (row: MultitrackRow) =>
  getPanLabel(getActiveMultitrackControlValue(row, "pan") ?? row.pan);
const clearMultitrackControl = (
  row: MultitrackRow,
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
  row: MultitrackRow,
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
const multitrackRows = computed<MultitrackRow[]>(() => {
  const trackRows = trackOrder.value.flatMap((trackId, trackIndex) => {
    const track = tracks.value.get(trackId);
    if (!track) return [];
    const character = getTrackCharacter(trackId);

    return [
      {
        id: `track:${trackId}`,
        kind: "singer" as const,
        trackId,
        name: track.name || `Track ${trackIndex + 1}`,
        isNameEditing: editingTrackNameId.value === trackId,
        singerName: character?.singerName ?? "未設定",
        singingTeacherLabel: getMultitrackSingingTeacherLabel(trackId),
        characterStyle: character?.style,
        statusLabel:
          track.notes.length === 0
            ? "空のシンガー"
            : `${track.notes.length} notes`,
        isSelected: trackId === selectedTrackId.value,
        isSolo: track.solo,
        isMuted: track.mute,
        gain: track.gain,
        pan: track.pan,
        panLabel: getPanLabel(track.pan),
        shouldPlay: playableTrackIds.value.has(trackId),
        keyRangeAdjustment: track.keyRangeAdjustment,
        volumeRangeAdjustment: track.volumeRangeAdjustment,
        lyricSummary: getLyricSummary(track.notes),
        notes: createPreviewNotes(track.notes, {
          errorNoteIds: getErrorNoteIdsForTrack(trackId),
          topOffset: MULTITRACK_NOTE_TOP_OFFSET,
          verticalRange: MULTITRACK_NOTE_VERTICAL_RANGE,
        }),
        clips: [],
      },
    ];
  });

  return [
    ...trackRows,
    {
      id: "mock-audio-track",
      kind: "audio" as const,
      name: "Audio Ref",
      isNameEditing: false,
      singerName: "",
      singingTeacherLabel: "",
      statusLabel: "clip align",
      isSelected: false,
      isSolo: false,
      isMuted: false,
      gain: 1,
      pan: 0,
      panLabel: "C",
      shouldPlay: true,
      keyRangeAdjustment: 0,
      volumeRangeAdjustment: 0,
      lyricSummary: "",
      notes: [],
      clips: [
        {
          id: "mock-audio-clip-main",
          left: mockAudioClipLeftPercent.value,
          width: MOCK_AUDIO_CLIP_WIDTH_PERCENT,
          peaks: MOCK_AUDIO_PEAKS,
        },
      ],
    },
  ];
});
const selectMultitrackRow = (row: MultitrackRow) => {
  if (row.trackId == undefined) return;

  void store.actions.SELECT_TRACK({ trackId: row.trackId });
};
const blurCurrentInput = (event: Event) => {
  if (event.target instanceof HTMLInputElement) {
    event.target.blur();
  }
};
const startMultitrackTrackNameEdit = (row: MultitrackRow) => {
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
const deleteTrackFromRow = (row: MultitrackRow) => {
  if (row.trackId == undefined) return;

  void deleteTrack(row.trackId);
};
const finishMultitrackTrackNameEdit = (row: MultitrackRow, event: Event) => {
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
  row: MultitrackRow,
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
  row: MultitrackRow,
  valueOrEvent: number | Event,
) => {
  previewMultitrackControl(row, "gain", valueOrEvent);
};
const commitMultitrackTrackGain = (
  row: MultitrackRow,
  valueOrEvent: number | Event,
) => {
  setMultitrackTrackGain(row, valueOrEvent);
  clearMultitrackControl(row, "gain");
};
const setMultitrackTrackPan = (
  row: MultitrackRow,
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
  row: MultitrackRow,
  valueOrEvent: number | Event,
) => {
  previewMultitrackControl(row, "pan", valueOrEvent);
};
const commitMultitrackTrackPan = (
  row: MultitrackRow,
  valueOrEvent: number | Event,
) => {
  setMultitrackTrackPan(row, valueOrEvent);
  clearMultitrackControl(row, "pan");
};
const setMultitrackTrackMute = (row: MultitrackRow, mute: boolean) => {
  if (row.trackId == undefined) return;

  if (store.state.undoableTrackOperations.soloAndMute) {
    void store.actions.COMMAND_SET_TRACK_MUTE({ trackId: row.trackId, mute });
  } else {
    void store.actions.SET_TRACK_MUTE({ trackId: row.trackId, mute });
  }
};
const setMultitrackTrackSolo = (row: MultitrackRow, solo: boolean) => {
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
const setMultitrackSingingTeacher = (row: MultitrackRow, event: Event) => {
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
const setMultitrackKeyRangeAdjustment = (row: MultitrackRow, event: Event) => {
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
  row: MultitrackRow,
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
  return createPreviewNotes(selectedTrack.value.notes, {
    errorNoteIds: getErrorNoteIdsForTrack(selectedTrackId.value),
    noteNumberRange: selectedTrackMinimapNoteNumberRange.value,
    topOffset: MINIMAP_NOTE_TOP_OFFSET,
    verticalRange: MINIMAP_NOTE_VERTICAL_RANGE,
  });
});
const minimapRegularNotes = computed(() =>
  minimapNotes.value.filter((note) => !note.isError),
);
const minimapErrorNotes = computed(() =>
  minimapNotes.value.filter((note) => note.isError),
);

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
  box-sizing: border-box;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container) 42%,
    var(--scheme-color-surface-container-highest)
  );
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-height: 80px;
  padding: 8px 14px 8px 0;
  width: 100%;
  border-bottom: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 54%, transparent);
  letter-spacing: 0.01em;

  &.mode-multitrack {
    min-height: calc(var(--sing-multitrack-arrangement-height) + 16px);
  }

  &.arrangement-mode-right {
    padding-right: 0;
  }

  &.mode-singer.arrangement-mode-right {
    padding-left: 12px;
  }
}

.sing-track-lane {
  align-items: stretch;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  position: relative;
  width: 100%;

  .sing-toolbar.arrangement-mode-right & {
    grid-template-columns: minmax(0, 1fr) 48px;
  }
}

.sing-arrangement-mode-column {
  box-sizing: border-box;
  grid-row: 1;
  grid-column: 1;
  display: grid;
  min-height: 64px;
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

  .mode-multitrack & {
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

  &.active {
    background: var(--scheme-color-secondary-container);
    color: var(--scheme-color-on-secondary-container);
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
  height: 64px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 38%, transparent);
  border-left: 0;
  border-radius: 0 6px 6px 0;
  background: var(--scheme-color-surface-container-highest);
  overflow: hidden;

  &.mode-multitrack {
    height: var(--sing-multitrack-arrangement-height);
  }

  .sing-toolbar.arrangement-mode-right & {
    grid-column: 1;
    border-right: 0;
    border-left: 1px solid
      color-mix(in oklch, var(--scheme-color-outline-variant) 38%, transparent);
    border-radius: 6px 0 0 6px;
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
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 72px;
  align-items: start;
  gap: 8px;
  min-width: 0;
  height: 64px;
  padding: 8px;
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
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container-highest) 88%,
      var(--scheme-color-secondary-container)
    );
    color: var(--scheme-color-on-surface);
    box-shadow: inset 3px 0 0 var(--scheme-color-secondary);
  }

  &.audio {
    color: color-mix(
      in oklch,
      var(--scheme-color-on-surface-variant) 88%,
      var(--scheme-color-secondary)
    );
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
  grid-template-columns: repeat(3, 20px);
  align-self: start;
  gap: 4px;
  justify-content: end;
}

.sing-multitrack-actions.audio-actions {
  grid-template-columns: 20px;
  justify-self: end;
}

.sing-multitrack-state-button,
.sing-multitrack-more-button {
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

.sing-minimap-layout.mode-singer {
  grid-template-rows: minmax(0, 1fr);
}

.sing-minimap-viewport {
  position: relative;
  grid-row: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.sing-minimap-layout.mode-singer .sing-minimap-viewport {
  grid-row: 1;
}

.sing-minimap-controls {
  display: grid;
  grid-row: 2;
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

  &:hover .sing-minimap-scrollbar-window,
  &.dragging .sing-minimap-scrollbar-window,
  &:focus-visible .sing-minimap-scrollbar-window {
    background: color-mix(
      in oklch,
      var(--scheme-color-on-surface-variant) 28%,
      transparent
    );
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
  background: color-mix(in oklch, var(--scheme-color-scrim) 18%, transparent);
  overflow: hidden;
  pointer-events: none;
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
    var(--scheme-color-on-surface-variant) 9%,
    transparent
  );
}

.sing-minimap-scrollbar-sequencer-window {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-highest) 92%,
    var(--scheme-color-surface-container-high)
  );
  pointer-events: none;
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
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: grab;
  font: inherit;
  text-align: left;
  overflow: hidden;
  transform-origin: left top;

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

  &.dragging {
    cursor: grabbing;
  }
}

.sing-minimap-sequencer-window {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  min-width: 8px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-secondary) 76%, transparent);
  border-radius: 6px;
  background: color-mix(
    in oklch,
    var(--scheme-color-secondary-container) 16%,
    transparent
  );
  pointer-events: none;
}

.sing-multitrack-map-scroll {
  position: relative;
  height: 100%;
  min-width: 0;
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
  will-change: transform;

  &:focus-visible {
    outline: 2px solid var(--scheme-color-secondary);
    outline-offset: -2px;
  }
}

.sing-multitrack-grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image:
    repeating-linear-gradient(
      90deg,
      color-mix(in oklch, var(--scheme-color-outline-variant) 24%, transparent)
        0,
      color-mix(in oklch, var(--scheme-color-outline-variant) 24%, transparent)
        1px,
      transparent 1px,
      transparent 48px
    ),
    repeating-linear-gradient(
      180deg,
      transparent 0,
      transparent 63px,
      color-mix(in oklch, var(--scheme-color-outline-variant) 24%, transparent)
        63px,
      color-mix(in oklch, var(--scheme-color-outline-variant) 24%, transparent)
        64px
    );
  pointer-events: none;
}

.sing-minimap-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 8;
  width: 2px;
  transform: translateX(-1px);
  background: var(--scheme-color-inverse-surface);
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

.sing-minimap-phrase-lyric {
  position: absolute;
  top: 4px;
  z-index: 6;
  display: flex;
  align-items: center;
  height: 15px;
  min-width: 18px;
  padding: 0 4px;
  color: var(--scheme-color-on-surface-variant);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  opacity: 0.68;
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

.sing-multitrack-map-row {
  position: relative;
  z-index: 1;
  min-width: 0;
  height: 64px;
  border-bottom: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 24%, transparent);
  overflow: hidden;

  &.selected {
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

.sing-multitrack-row-lyric {
  position: absolute;
  top: 5px;
  left: 8px;
  right: 8px;
  z-index: 2;
  color: var(--scheme-color-on-surface);
  font-size: 9px;
  font-weight: 600;
  line-height: 10px;
  overflow: hidden;
  pointer-events: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sing-minimap-note {
  position: absolute;
  z-index: 5;
  height: 2px;
  min-width: 5px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: color-mix(
    in oklch,
    var(--scheme-color-secondary) 46%,
    var(--scheme-color-on-surface-variant)
  );
  color: var(--scheme-color-on-secondary-container);
  opacity: 0.58;
  overflow: hidden;
  pointer-events: none;
  transform: translateY(2px);

  &.error {
    z-index: 7;
    height: 4px;
    min-width: 7px;
    border-radius: 2px;
    background: color-mix(
      in oklch,
      var(--scheme-color-error) 88%,
      var(--scheme-color-error-container)
    );
    opacity: 0.96;
    transform: translateY(1px);
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
