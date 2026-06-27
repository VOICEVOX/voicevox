<template>
  <div
    class="score-sequencer-shell"
    :class="[
      `tool-layout-${toolPaletteLayout}`,
      { 'tool-layout-docked': isScoreDockLayout },
      { 'tool-layout-header-rail': isScoreHeaderRailLayout },
      { 'tool-layout-reserved-rail': isScoreReservedRailLayout },
      { 'tool-layout-surface-strip': isScoreSurfaceStripLayout },
      { 'tool-layout-command-bar': isScoreTrueCommandLayout },
      { 'tool-layout-mode-context': isScoreModeContextLayout },
      { 'tool-layout-context-hud': isScoreContextHudLayout },
      { 'tool-layout-inspector-header': isScoreInspectorHeaderLayout },
      { 'tool-layout-tool-chip': isScoreToolChipLayout },
    ]"
  >
    <QSplitter
      :modelValue="isParameterPanelOpen ? parameterPanelHeight : 0"
      reverse
      unit="px"
      horizontal
      class="full-height"
      :disable="!isParameterPanelOpen"
      :separatorStyle="{
        display: isParameterPanelOpen ? 'block' : 'none',
        // NOTE: 当たり判定を小さくする
        overflow: 'hidden',
        height: '4px',
      }"
      @update:modelValue="setParameterPanelHeight"
    >
      <template #before>
        <div class="score-sequencer full-height">
          <div class="piano-roll-toolbar" aria-label="ピアノロール操作">
            <span v-if="isScoreTrueCommandLayout" class="surface-command-title">
              ピアノロール
            </span>
            <div class="piano-roll-mode-zone">
              <div
                class="piano-roll-edit-target-tabs"
                role="tablist"
                aria-label="編集対象"
              >
                <button
                  class="piano-roll-edit-target-tab"
                  :class="{ active: editTarget === 'NOTE' }"
                  type="button"
                  role="tab"
                  aria-label="ノート"
                  title="ノート"
                  :aria-selected="editTarget === 'NOTE'"
                  @click="changeEditTarget('NOTE')"
                >
                  <span v-if="usesPianoTextTabs">ノート</span>
                  <span v-else class="edit-target-button-content">
                    <span class="material-symbols-rounded" aria-hidden="true">
                      edit_note
                    </span>
                    <span class="edit-target-button-label">ノート</span>
                  </span>
                </button>
                <button
                  class="piano-roll-edit-target-tab"
                  :class="{ active: editTarget === 'PITCH' }"
                  type="button"
                  role="tab"
                  aria-label="ピッチ"
                  title="ピッチ"
                  :aria-selected="editTarget === 'PITCH'"
                  @click="changeEditTarget('PITCH')"
                >
                  <span v-if="usesPianoTextTabs">ピッチ</span>
                  <span v-else class="edit-target-button-content">
                    <span class="material-symbols-rounded" aria-hidden="true">
                      timeline
                    </span>
                    <span class="edit-target-button-label">ピッチ</span>
                  </span>
                </button>
              </div>
              <SequencerToolPalette
                v-if="
                  isScoreInlineRailLayout ||
                  isScoreInlineCommandToolLayout ||
                  toolPaletteLayout === 'dock'
                "
                :editTarget
                :sequencerNoteTool
                :sequencerPitchTool
                :orientation="
                  isScoreInlineCommandToolLayout || toolPaletteLayout === 'dock'
                    ? 'horizontal'
                    : 'vertical'
                "
                @update:sequencerNoteTool="setSequencerNoteTool"
                @update:sequencerPitchTool="setSequencerPitchTool"
              />
            </div>
            <div
              v-if="isScoreModeContextLayout"
              class="piano-roll-context-strip"
            >
              <span class="context-strip-target">{{ pianoModeLabel }}</span>
              <SequencerToolPalette
                :editTarget
                :sequencerNoteTool
                :sequencerPitchTool
                orientation="horizontal"
                @update:sequencerNoteTool="setSequencerNoteTool"
                @update:sequencerPitchTool="setSequencerPitchTool"
              />
            </div>
            <div v-if="isScoreContextHudLayout" class="piano-roll-context-hud">
              <span class="context-hud-label">{{ currentPianoToolLabel }}</span>
              <SequencerToolPalette
                :editTarget
                :sequencerNoteTool
                :sequencerPitchTool
                orientation="horizontal"
                @update:sequencerNoteTool="setSequencerNoteTool"
                @update:sequencerPitchTool="setSequencerPitchTool"
              />
            </div>
            <div
              v-if="isScoreToolChipLayout"
              class="piano-roll-current-tool-zone"
            >
              <button
                class="current-tool-chip"
                type="button"
                :title="currentPianoToolLabel"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  {{ currentPianoToolIcon }}
                </span>
                <span>{{ currentPianoToolLabel }}</span>
              </button>
              <button
                class="command-palette-button"
                type="button"
                title="コマンドを検索"
              >
                <span class="material-symbols-rounded" aria-hidden="true">
                  keyboard_command_key
                </span>
              </button>
              <div class="tool-chip-popover">
                <SequencerToolPalette
                  :editTarget
                  :sequencerNoteTool
                  :sequencerPitchTool
                  orientation="horizontal"
                  @update:sequencerNoteTool="setSequencerNoteTool"
                  @update:sequencerPitchTool="setSequencerPitchTool"
                />
              </div>
            </div>
            <div
              v-if="toolPaletteLayout === 'reservedRail'"
              class="piano-roll-tool-zone"
            >
              <SequencerToolPalette
                :editTarget
                :sequencerNoteTool
                :sequencerPitchTool
                orientation="vertical"
                @update:sequencerNoteTool="setSequencerNoteTool"
                @update:sequencerPitchTool="setSequencerPitchTool"
              />
            </div>
            <div
              v-if="
                toolPaletteLayout !== 'rail' &&
                toolPaletteLayout !== 'proposalB' &&
                toolPaletteLayout !== 'dock' &&
                toolPaletteLayout !== 'proposalE' &&
                toolPaletteLayout !== 'proposalF' &&
                toolPaletteLayout !== 'proposalG' &&
                toolPaletteLayout !== 'proposalH' &&
                toolPaletteLayout !== 'proposalI' &&
                toolPaletteLayout !== 'proposalJ' &&
                toolPaletteLayout !== 'reservedRail'
              "
              class="piano-roll-floating-tools"
              :class="[
                `layout-${toolPaletteLayout}`,
                { 'active-target-pitch': editTarget === 'PITCH' },
              ]"
            >
              <SequencerToolPalette
                :editTarget
                :sequencerNoteTool
                :sequencerPitchTool
                :orientation="pianoToolPaletteOrientation"
                @update:sequencerNoteTool="setSequencerNoteTool"
                @update:sequencerPitchTool="setSequencerPitchTool"
              />
            </div>
            <button
              v-if="isScoreTrueCommandLayout"
              class="piano-roll-command-button"
              type="button"
              title="その他"
            >
              <span class="material-symbols-rounded" aria-hidden="true">
                more_horiz
              </span>
            </button>
            <label class="piano-roll-snap-control">
              <span class="piano-roll-snap-label">スナップ</span>
              <select
                class="piano-roll-snap-select"
                :value="sequencerSnapType"
                @change="setSnapType"
              >
                <option
                  v-for="option in snapTypeSelectOptions"
                  :key="option.snapType"
                  :value="option.snapType"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>
          <!-- 左上の角 -->
          <div class="sequencer-corner"></div>
          <!-- ルーラー -->
          <SequencerRuler
            class="sequencer-ruler"
            :offset="scrollX"
            :numMeasures
          />
          <!-- 鍵盤 -->
          <SequencerKeys
            class="sequencer-keys"
            :offset="scrollY"
            :blackKeyWidth="28"
          />
          <!-- グリッド -->
          <SequencerGrid
            class="sequencer-grid"
            :offsetX="scrollX"
            :offsetY="scrollY"
            :style="{
              marginRight: `${scrollBarWidth}px`,
              marginBottom: `${scrollBarWidth}px`,
            }"
          />
          <!-- キャラクター全身 -->
          <CharacterPortrait
            class="sequencer-character-portrait"
            :style="{
              marginRight: `${scrollBarWidth}px`,
              marginBottom: `${scrollBarWidth}px`,
            }"
          />
          <!-- ノート入力のための補助線 -->
          <div
            v-if="editTarget === 'NOTE' && showGuideLine"
            class="sequencer-guideline-container"
            :style="{
              marginRight: `${scrollBarWidth}px`,
              marginBottom: `${scrollBarWidth}px`,
            }"
          >
            <div
              class="sequencer-guideline"
              :style="{
                transform: `translateX(${guideLineX - scrollX}px)`,
              }"
            ></div>
          </div>
          <!-- シーケンサ -->
          <div
            ref="sequencerBody"
            class="sequencer-body"
            :class="{
              'edit-note': editTarget === 'NOTE',
              'edit-pitch': editTarget === 'PITCH',
              [cursorClass]: true,
            }"
            aria-label="シーケンサ"
            @pointerdown="onPointerDown"
            @pointerenter="onPointerEnter"
            @pointerleave="onPointerLeave"
            @dblclick.stop="onDoubleClick"
            @wheel="onWheel"
            @scroll="onScroll"
            @contextmenu.prevent
          >
            <!-- 実際のグリッド全体と同じ大きさを持つ要素 -->
            <SequencerGridSpacer />
            <!-- undefinedだと警告が出るのでnullを渡す -->
            <!-- TODO: ちゃんとしたトラックIDを渡す -->
            <SequencerShadowNote
              v-for="note in notesInOtherTracks"
              :key="note.id"
              :note
            />
            <SequencerNote
              v-for="note in editTarget === 'NOTE'
                ? notesInSelectedTrackWithPreview
                : notesInSelectedTrack"
              :key="note.id"
              class="sequencer-note"
              :note
              :isSelected="selectedNoteIds.has(note.id)"
              :isPreview="previewNoteIds.has(note.id)"
              :isOverlapping="overlappingNoteIdsInSelectedTrack.has(note.id)"
              :previewLyric="previewLyrics.get(note.id) ?? null"
              :nowPreviewing
              :previewMode
              :cursorClass
              @barPointerdown="onNoteBarPointerDown($event, note)"
              @barDoubleClick="onNoteBarDoubleClick($event, note)"
              @leftEdgePointerdown="onNoteLeftEdgePointerDown($event, note)"
              @rightEdgePointerdown="onNoteRightEdgePointerDown($event, note)"
            />
            <SequencerLyricInput
              v-if="editingLyricNote != undefined"
              :editingLyricNote
              @input="onLyricInput"
              @keydown="onLyricInputKeydown"
              @blur="onLyricInputBlur"
            />
          </div>
          <SequencerPitch
            v-if="editTarget === 'PITCH'"
            class="sequencer-pitch"
            :style="{
              marginRight: `${scrollBarWidth}px`,
              marginBottom: `${scrollBarWidth}px`,
            }"
            :offsetX="scrollX"
            :offsetY="scrollY"
            :previewPitchEdit
          />
          <div
            class="sequencer-overlay"
            :style="{
              marginRight: `${scrollBarWidth}px`,
              marginBottom: `${scrollBarWidth}px`,
            }"
          >
            <div
              v-if="previewRectForRectSelect != undefined"
              class="rect-select-preview"
              :style="{
                left: `${previewRectForRectSelect.x}px`,
                top: `${previewRectForRectSelect.y}px`,
                width: `${previewRectForRectSelect.width}px`,
                height: `${previewRectForRectSelect.height}px`,
              }"
            ></div>
            <SequencerPhraseIndicator
              v-for="phraseInfo in phraseInfosInOtherTracks"
              :key="phraseInfo.key"
              :phraseKey="phraseInfo.key"
              :isInSelectedTrack="false"
              class="sequencer-phrase-indicator"
              :style="{
                width: `${phraseInfo.width}px`,
                transform: `translateX(${phraseInfo.x - scrollX}px)`,
              }"
            />
            <SequencerPhraseIndicator
              v-for="phraseInfo in phraseInfosInSelectedTrack"
              :key="phraseInfo.key"
              :phraseKey="phraseInfo.key"
              isInSelectedTrack
              class="sequencer-phrase-indicator"
              :style="{
                width: `${phraseInfo.width}px`,
                transform: `translateX(${phraseInfo.x - scrollX}px)`,
              }"
            />
            <div
              class="sequencer-playhead"
              data-testid="sequencer-playhead"
              :style="{
                transform: `translateX(${playheadX - scrollX - 1}px)`,
              }"
            ></div>
          </div>
          <QSlider
            :modelValue="zoomX"
            :min="ZOOM_X_MIN"
            :max="ZOOM_X_MAX"
            :step="ZOOM_X_STEP"
            class="zoom-x-slider"
            trackSize="2px"
            @update:modelValue="setZoomX"
          />
          <QSlider
            :modelValue="zoomY"
            :min="ZOOM_Y_MIN"
            :max="ZOOM_Y_MAX"
            :step="ZOOM_Y_STEP"
            vertical
            reverse
            class="zoom-y-slider"
            trackSize="2px"
            @update:modelValue="setZoomY"
          />
          <ContextMenu ref="contextMenu" :menudata="contextMenuData" />
        </div>
      </template>
      <template #after>
        <SequencerParameterPanel
          v-if="isParameterPanelOpen"
          :viewportInfo
          :toolPaletteLayout
          :parameterPanelLayoutMode
          :volumeEditValueMode
          @update:needsAutoScroll="
            (value) => (parameterPanelNeedsAutoScroll = value)
          "
          @panTimeline="panTimelineBy"
          @zoomTimeline="zoomTimelineAt"
        />
      </template>
    </QSplitter>
    <div
      class="sequencer-full-playhead-layer"
      :style="{
        left: `${fullPlayheadLeftOffset}px`,
        right: `${fullPlayheadRightInset}px`,
      }"
    >
      <div
        class="sequencer-full-playhead"
        data-testid="sequencer-full-playhead"
        :style="{
          transform: `translateX(${playheadX - scrollX - 1}px)`,
        }"
      ></div>
    </div>
    <div class="tool-layout-switcher" aria-label="ツール配置">
      <div class="tool-layout-switcher-grip" aria-hidden="true"></div>
      <div class="tool-layout-switcher-panel">
        <div class="tool-layout-switcher-section-label">Tools</div>
        <button
          v-for="option in TOOL_PALETTE_LAYOUT_OPTIONS"
          :key="option.value"
          class="tool-layout-switch"
          :class="{ active: toolPaletteLayout === option.value }"
          type="button"
          :aria-pressed="toolPaletteLayout === option.value"
          :title="option.label"
          @click="toolPaletteLayout = option.value"
        >
          {{ option.label }}
        </button>
        <div class="tool-layout-switcher-section-label">Parameter Panel</div>
        <button
          v-for="option in PARAMETER_PANEL_LAYOUT_OPTIONS"
          :key="option.value"
          class="tool-layout-switch"
          :class="{ active: parameterPanelLayoutMode === option.value }"
          type="button"
          :aria-pressed="parameterPanelLayoutMode === option.value"
          :title="option.label"
          @click="parameterPanelLayoutMode = option.value"
        >
          {{ option.label }}
        </button>
        <div class="tool-layout-switcher-section-label">Volume</div>
        <button
          v-for="option in VOLUME_EDIT_VALUE_MODE_OPTIONS"
          :key="option.value"
          class="tool-layout-switch"
          :class="{ active: volumeEditValueMode === option.value }"
          type="button"
          :aria-pressed="volumeEditValueMode === option.value"
          :title="option.label"
          @click="volumeEditValueMode = option.value"
        >
          {{ option.label }}
        </button>
        <div class="tool-layout-switcher-section-label">Reference</div>
        <button
          v-for="option in REFERENCE_OVERLAY_MODE_OPTIONS"
          :key="option.value"
          class="tool-layout-switch"
          :class="{ active: referenceOverlayMode === option.value }"
          type="button"
          :aria-pressed="referenceOverlayMode === option.value"
          :title="option.label"
          @click="referenceOverlayMode = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { ComputedRef } from "vue";
import type { InjectionKey } from "vue";

export const numMeasuresInjectionKey: InjectionKey<{
  numMeasures: ComputedRef<number>;
}> = Symbol("sequencerNumMeasures");
</script>

<script setup lang="ts">
import {
  computed,
  ref,
  nextTick,
  onMounted,
  onActivated,
  onDeactivated,
  watch,
  provide,
} from "vue";
import SequencerParameterPanel from "@/components/Sing/SequencerParameterPanel.vue";
import SequencerGridSpacer from "@/components/Sing/SequencerGridSpacer.vue";
import ContextMenu, {
  type ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Container.vue";
import { useStore } from "@/store";
import type { Note } from "@/domain/project/type";
import {
  getNoteDuration,
  getTimeSignaturePositions,
  isTriplet,
  noteNumberToFrequency,
  tickToMeasureNumber,
  tickToSecond,
} from "@/sing/music";
import {
  getEndTicksOfPhrase,
  getSnapTypes,
  getStartTicksOfPhrase,
} from "@/sing/domain";
import {
  tickToBaseX,
  baseXToTick,
  noteNumberToBaseY,
  baseYToNoteNumber,
  ZOOM_X_MIN,
  ZOOM_X_MAX,
  ZOOM_X_STEP,
  ZOOM_Y_MIN,
  ZOOM_Y_MAX,
  ZOOM_Y_STEP,
  PREVIEW_SOUND_DURATION,
  SEQUENCER_MIN_NUM_MEASURES,
} from "@/sing/viewHelper";
import { clamp, getLast } from "@/sing/utility";
import SequencerGrid from "@/components/Sing/SequencerGrid/Container.vue";
import SequencerRuler from "@/components/Sing/SequencerRuler/Container.vue";
import SequencerKeys from "@/components/Sing/SequencerKeys.vue";
import SequencerNote from "@/components/Sing/SequencerNote.vue";
import SequencerShadowNote from "@/components/Sing/SequencerShadowNote.vue";
import SequencerPhraseIndicator from "@/components/Sing/SequencerPhraseIndicator.vue";
import CharacterPortrait from "@/components/Sing/CharacterPortrait.vue";
import SequencerPitch from "@/components/Sing/SequencerPitch.vue";
import SequencerLyricInput from "@/components/Sing/SequencerLyricInput.vue";
import SequencerToolPalette from "@/components/Sing/SequencerToolPalette.vue";
import {
  TOOL_PALETTE_LAYOUT_OPTIONS,
  type ToolPaletteLayout,
} from "@/components/Sing/toolPaletteLayout";
import {
  PARAMETER_PANEL_LAYOUT_OPTIONS,
  REFERENCE_OVERLAY_MODE_OPTIONS,
  VOLUME_EDIT_VALUE_MODE_OPTIONS,
  type ParameterPanelLayoutMode,
  type ReferenceOverlayMode,
  type VolumeEditValueMode,
} from "@/components/Sing/parameterPanelViewMode";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import { createLogger } from "@/helpers/log";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import { useSequencerStateMachine } from "@/composables/useSequencerStateMachine";
import type {
  PositionOnSequencer,
  ViewportInfo,
} from "@/sing/sequencerStateMachine/common";
import type {
  NoteEditTool,
  PitchEditTool,
  SequencerEditTarget,
} from "@/store/type";
import { useAutoScrollOnEdge } from "@/composables/useAutoScrollOnEdge";
import { assertNonNullable } from "@/type/utility";

const { warn } = createLogger("ScoreSequencer");
const store = useStore();
const state = store.state;

// トラック、TPQN、テンポ、拍子、ノーツ
const tpqn = computed(() => state.tpqn);
const tempos = computed(() => state.tempos);
const timeSignatures = computed(() => store.state.timeSignatures);
const tracks = computed(() => store.state.tracks);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const notesInSelectedTrack = computed(() => store.getters.SELECTED_TRACK.notes);
const notesInOtherTracks = computed(() =>
  [...tracks.value.entries()].flatMap(([trackId, track]) =>
    trackId === selectedTrackId.value ? [] : track.notes,
  ),
);
const overlappingNoteIdsInSelectedTrack = computed(() =>
  store.getters.OVERLAPPING_NOTE_IDS(selectedTrackId.value),
);
const selectedNotes = computed(() =>
  notesInSelectedTrack.value.filter((note) =>
    selectedNoteIds.value.has(note.id),
  ),
);
const selectedNoteIds = computed(
  () => new Set(store.getters.SELECTED_NOTE_IDS),
);
const isNoteSelected = computed(() => {
  return selectedNoteIds.value.size > 0;
});
const notesInSelectedTrackWithPreview = computed(() => {
  if (nowPreviewing.value) {
    const previewNoteIds = new Set(previewNotes.value.map((value) => value.id));
    return previewNotes.value
      .concat(
        notesInSelectedTrack.value.filter(
          (note) => !previewNoteIds.has(note.id),
        ),
      )
      .toSorted((a, b) => {
        const aIsSelectedOrPreview =
          selectedNoteIds.value.has(a.id) || previewNoteIds.has(a.id);
        const bIsSelectedOrPreview =
          selectedNoteIds.value.has(b.id) || previewNoteIds.has(b.id);
        if (aIsSelectedOrPreview === bIsSelectedOrPreview) {
          return a.position - b.position;
        } else {
          // 「プレビュー中か選択中のノート」が「選択されていないノート」より
          // 手前に表示されるようにする
          return aIsSelectedOrPreview ? 1 : -1;
        }
      });
  } else {
    return notesInSelectedTrack.value.toSorted((a, b) => {
      const aIsSelected = selectedNoteIds.value.has(a.id);
      const bIsSelected = selectedNoteIds.value.has(b.id);
      if (aIsSelected === bIsSelected) {
        return a.position - b.position;
      } else {
        // 「選択中のノート」が「選択されていないノート」より手前に表示されるようにする
        return aIsSelected ? 1 : -1;
      }
    });
  }
});

// ズーム状態
const zoomX = computed(() => state.sequencerZoomX);
const zoomY = computed(() => state.sequencerZoomY);

// スナップ
const snapTicks = computed(() => {
  return getNoteDuration(state.sequencerSnapType, tpqn.value);
});

// 小節の数
// NOTE: スコア長(曲長さ)が決まっていないため、無限スクロール化する or 最後尾に足した場合は伸びるようにするなど？
// NOTE: いったん最後尾に足した場合は伸びるようにする
const numMeasures = computed(() => {
  const tsPositions = getTimeSignaturePositions(
    timeSignatures.value,
    tpqn.value,
  );
  const notes = [...tracks.value.values()].flatMap((track) => track.notes);
  const noteEndPositions = notes.map((note) => note.position + note.duration);

  let maxTicks = 0;

  const lastTsPosition = tsPositions[tsPositions.length - 1];
  maxTicks = Math.max(maxTicks, lastTsPosition);

  const lastTempoPosition = getLast(tempos.value).position;
  maxTicks = Math.max(maxTicks, lastTempoPosition);

  for (const noteEndPosition of noteEndPositions) {
    maxTicks = Math.max(maxTicks, noteEndPosition);
  }

  return Math.max(
    SEQUENCER_MIN_NUM_MEASURES,
    tickToMeasureNumber(maxTicks, timeSignatures.value, tpqn.value) + 8,
  );
});

provide(numMeasuresInjectionKey, { numMeasures });

// スクロール位置
const scrollX = ref(0);
const scrollY = ref(0);

// ビューポートの情報
const viewportInfo = computed<ViewportInfo>(() => {
  return {
    scaleX: zoomX.value,
    scaleY: zoomY.value,
    offsetX: scrollX.value,
    offsetY: scrollY.value,
  };
});

// 再生ヘッドの位置
const playheadTicks = computed(() => store.getters.PLAYHEAD_POSITION);
const playheadX = computed(() => {
  const baseX = tickToBaseX(playheadTicks.value, tpqn.value);
  return Math.floor(baseX * zoomX.value);
});

// フレーズ
const phraseInfos = computed(() => {
  return [...state.phrases.entries()].map(([key, phrase]) => {
    const startTicks = getStartTicksOfPhrase(phrase);
    const endTicks = getEndTicksOfPhrase(phrase);
    const startBaseX = tickToBaseX(startTicks, tpqn.value);
    const endBaseX = tickToBaseX(endTicks, tpqn.value);
    const startX = startBaseX * zoomX.value;
    const endX = endBaseX * zoomX.value;
    const trackId = phrase.trackId;
    return { key, x: startX, width: endX - startX, trackId };
  });
});
const phraseInfosInSelectedTrack = computed(() => {
  return phraseInfos.value.filter(
    (info) => info.trackId === selectedTrackId.value,
  );
});
const phraseInfosInOtherTracks = computed(() => {
  return phraseInfos.value.filter(
    (info) => info.trackId !== selectedTrackId.value,
  );
});

const DEFAULT_PARAMETER_PANEL_HEIGHT = 200;
const MIN_PARAMETER_PANEL_HEIGHT = 100;
const MAX_PARAMETER_PANEL_HEIGHT = 500;

const splitterPosition = computed(() => store.state.splitterPosition);
const parameterPanelHeight = ref(DEFAULT_PARAMETER_PANEL_HEIGHT);
const isParameterPanelOpen = computed(
  () => store.state.experimentalSetting.showParameterPanel,
);

watch(
  isParameterPanelOpen,
  (isOpen) => {
    if (isOpen) {
      const saved = splitterPosition.value.parameterPanelHeight;
      parameterPanelHeight.value = clamp(
        saved ?? DEFAULT_PARAMETER_PANEL_HEIGHT,
        MIN_PARAMETER_PANEL_HEIGHT,
        MAX_PARAMETER_PANEL_HEIGHT,
      );
    }
  },
  { immediate: true },
);

const setParameterPanelHeight = async (height: number) => {
  if (!isParameterPanelOpen.value) return;
  parameterPanelHeight.value = height;
  await store.actions.SET_ROOT_MISC_SETTING({
    key: "splitterPosition",
    value: {
      ...splitterPosition.value,
      parameterPanelHeight: height,
    },
  });
};

const scrollBarWidth = ref(12);
const sequencerBody = ref<HTMLElement | null>(null);
const parameterPanelNeedsAutoScroll = ref(false);
const toolPaletteLayout = ref<ToolPaletteLayout>("sideRight");
const parameterPanelLayoutMode = ref<ParameterPanelLayoutMode>("single");
const volumeEditValueMode = ref<VolumeEditValueMode>("absolute");
const referenceOverlayMode = ref<ReferenceOverlayMode>("none");
const isScoreInlineRailLayout = computed(
  () =>
    toolPaletteLayout.value === "rail" ||
    toolPaletteLayout.value === "proposalB",
);
const isScoreDockLayout = computed(
  () =>
    toolPaletteLayout.value === "dock" ||
    toolPaletteLayout.value === "dockCenter",
);
const isScoreHeaderRailLayout = computed(
  () => toolPaletteLayout.value === "proposalC",
);
const isScoreReservedRailLayout = computed(
  () => toolPaletteLayout.value === "reservedRail",
);
const isScoreSurfaceStripLayout = computed(
  () =>
    toolPaletteLayout.value === "proposalE" ||
    toolPaletteLayout.value === "proposalF" ||
    toolPaletteLayout.value === "proposalI" ||
    toolPaletteLayout.value === "proposalJ",
);
const isScoreInlineCommandToolLayout = computed(
  () =>
    toolPaletteLayout.value === "proposalE" ||
    toolPaletteLayout.value === "proposalF" ||
    toolPaletteLayout.value === "proposalI",
);
const isScoreTrueCommandLayout = computed(
  () => toolPaletteLayout.value === "proposalF",
);
const isScoreModeContextLayout = computed(
  () => toolPaletteLayout.value === "proposalG",
);
const isScoreContextHudLayout = computed(
  () => toolPaletteLayout.value === "proposalH",
);
const isScoreInspectorHeaderLayout = computed(
  () => toolPaletteLayout.value === "proposalI",
);
const isScoreToolChipLayout = computed(
  () => toolPaletteLayout.value === "proposalJ",
);
const usesPianoTextTabs = computed(
  () =>
    isScoreDockLayout.value ||
    isScoreHeaderRailLayout.value ||
    isScoreSurfaceStripLayout.value,
);
const fullPlayheadLeftOffset = computed(() => {
  if (isScoreDockLayout.value || isScoreSurfaceStripLayout.value) return 48;
  if (isScoreReservedRailLayout.value) return 144;
  if (toolPaletteLayout.value === "sideRight") return 48;
  return 96;
});
const fullPlayheadRightInset = computed(() =>
  toolPaletteLayout.value === "sideRight" ? 48 : 0,
);
const pianoToolPaletteOrientation = computed<"vertical" | "horizontal">(() =>
  toolPaletteLayout.value === "center" ||
  toolPaletteLayout.value === "centerBottom" ||
  toolPaletteLayout.value === "dockCenter"
    ? "horizontal"
    : "vertical",
);

// ステートマシン
const {
  stateMachineProcess,
  previewMode,
  previewNotes,
  previewLyrics,
  previewRectForRectSelect,
  previewPitchEdit,
  cursorState,
  guideLineTicks,
  enableAutoScrollOnEdge,
} = useSequencerStateMachine({ store, viewportInfo });

const nowPreviewing = computed(() => previewMode.value !== "IDLE");

const previewNoteIds = computed(() => {
  return new Set(previewNotes.value.map((note) => note.id));
});

// マウスカーソルがシーケンサーの端に行ったときの自動スクロール
const combinedEnableAutoScrollOnEdge = computed(
  () => enableAutoScrollOnEdge.value || parameterPanelNeedsAutoScroll.value,
);
const autoScrollDirection = computed<"x" | "xy">(() =>
  parameterPanelNeedsAutoScroll.value ? "x" : "xy",
);
useAutoScrollOnEdge(sequencerBody, combinedEnableAutoScrollOnEdge, {
  scrollDirection: autoScrollDirection,
});

// 歌詞を編集中のノート
const editingLyricNote = computed(() => {
  return notesInSelectedTrack.value.find(
    (note) => note.id === state.editingLyricNoteId,
  );
});

// 入力を補助する線
const showGuideLine = ref(true);
const guideLineX = computed(() => {
  const guideLineBaseX = tickToBaseX(guideLineTicks.value, tpqn.value);
  return guideLineBaseX * zoomX.value;
});

// 編集対象
const editTarget = computed(() => store.state.sequencerEditTarget);
const changeEditTarget = (editTarget: SequencerEditTarget) => {
  void store.actions.SET_EDIT_TARGET({ editTarget });
};
// 選択中のノート編集ツール
const sequencerNoteTool = computed(() => state.sequencerNoteTool);
const setSequencerNoteTool = (sequencerNoteTool: NoteEditTool) => {
  void store.actions.SET_SEQUENCER_NOTE_TOOL({ sequencerNoteTool });
};
// 選択中のピッチ編集ツール
const sequencerPitchTool = computed(() => state.sequencerPitchTool);
const setSequencerPitchTool = (sequencerPitchTool: PitchEditTool) => {
  void store.actions.SET_SEQUENCER_PITCH_TOOL({ sequencerPitchTool });
};

const pianoModeLabel = computed(() =>
  editTarget.value === "NOTE" ? "ノート" : "ピッチ",
);
const currentPianoToolLabel = computed(() => {
  if (editTarget.value === "NOTE") {
    return sequencerNoteTool.value === "SELECT_FIRST" ? "選択優先" : "編集優先";
  }

  return sequencerPitchTool.value === "DRAW" ? "ピッチ編集" : "ピッチ削除";
});
const currentPianoToolIcon = computed(() => {
  if (editTarget.value === "NOTE") {
    return sequencerNoteTool.value === "SELECT_FIRST"
      ? "arrow_selector_tool"
      : "stylus";
  }

  return sequencerPitchTool.value === "DRAW" ? "stylus" : "ink_eraser";
});

const sequencerSnapType = computed(() => state.sequencerSnapType);
const snapTypeSelectOptions = computed(() => {
  return getSnapTypes(tpqn.value)
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
const setSnapType = (event: Event) => {
  void store.actions.SET_SNAP_TYPE({
    snapType: Number((event.target as HTMLSelectElement).value),
  });
};

// カーソル用のCSSクラス名ヘルパー
const cursorClass = computed(() => {
  switch (cursorState.value) {
    case "EW_RESIZE":
      return "cursor-ew-resize";
    case "CROSSHAIR":
      return "cursor-crosshair";
    case "MOVE":
      return "cursor-move";
    case "DRAW":
      return "cursor-draw";
    case "ERASE":
      return "cursor-erase";
    default:
      return "";
  }
});

const getXInBorderBox = (clientX: number, element: HTMLElement) => {
  return clientX - element.getBoundingClientRect().left;
};

const getYInBorderBox = (clientY: number, element: HTMLElement) => {
  return clientY - element.getBoundingClientRect().top;
};

const getCursorPosOnSequencer = (
  mouseEvent: MouseEvent,
): PositionOnSequencer => {
  const frameRate = state.editorFrameRate;
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  const scrollLeft = sequencerBodyElement.scrollLeft;
  const scrollTop = sequencerBodyElement.scrollTop;

  const cursorPosX = getXInBorderBox(mouseEvent.clientX, sequencerBodyElement);
  const cursorBaseX = (scrollLeft + cursorPosX) / zoomX.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const cursorSeconds = tickToSecond(cursorTicks, tempos.value, tpqn.value);
  const cursorFrame = Math.round(cursorSeconds * frameRate);

  const cursorPosY = getYInBorderBox(mouseEvent.clientY, sequencerBodyElement);
  const cursorBaseY = (scrollTop + cursorPosY) / zoomY.value;
  const cursorNoteNumberInt = baseYToNoteNumber(cursorBaseY, true);
  const cursorNoteNumberFloat = baseYToNoteNumber(cursorBaseY, false);
  const cursorFrequency = noteNumberToFrequency(cursorNoteNumberFloat);

  return {
    x: cursorPosX,
    y: cursorPosY,
    ticks: cursorTicks,
    noteNumber: cursorNoteNumberInt,
    frame: cursorFrame,
    frequency: cursorFrequency,
  };
};

const onNoteBarPointerDown = (event: PointerEvent, note: Note) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "Note",
    pointerEvent: event,
    cursorPos: getCursorPosOnSequencer(event),
    note,
  });
};

const onNoteBarDoubleClick = (event: MouseEvent, note: Note) => {
  stateMachineProcess({
    type: "mouseEvent",
    targetArea: "Note",
    mouseEvent: event,
    cursorPos: getCursorPosOnSequencer(event),
    note,
  });
};

const onNoteLeftEdgePointerDown = (event: PointerEvent, note: Note) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "NoteLeftEdge",
    pointerEvent: event,
    cursorPos: getCursorPosOnSequencer(event),
    note,
  });
};

const onNoteRightEdgePointerDown = (event: PointerEvent, note: Note) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "NoteRightEdge",
    pointerEvent: event,
    cursorPos: getCursorPosOnSequencer(event),
    note,
  });
};

const onPointerDown = (event: PointerEvent) => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  const cursorPos = getCursorPosOnSequencer(event);
  // NOTE: SequencerBodyにスクロールバーが含まれているため、スクロールバーのところはクリックイベントを無視する
  if (
    cursorPos.x < sequencerBodyElement.clientWidth &&
    cursorPos.y < sequencerBodyElement.clientHeight
  ) {
    stateMachineProcess({
      type: "pointerEvent",
      targetArea: "SequencerBody",
      pointerEvent: event,
      cursorPos,
    });
  }
};

const onPointerMove = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "Window",
    pointerEvent: event,
    cursorPos: getCursorPosOnSequencer(event),
  });
};

const onPointerUp = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "Window",
    pointerEvent: event,
    cursorPos: getCursorPosOnSequencer(event),
  });
};

const onDoubleClick = (event: MouseEvent) => {
  stateMachineProcess({
    type: "mouseEvent",
    targetArea: "SequencerBody",
    mouseEvent: event,
    cursorPos: getCursorPosOnSequencer(event),
  });
};

const onLyricInput = (event: Event) => {
  stateMachineProcess({
    type: "inputEvent",
    targetArea: "LyricInput",
    inputEvent: event,
  });
};

const onLyricInputKeydown = (event: KeyboardEvent) => {
  stateMachineProcess({
    type: "keyboardEvent",
    targetArea: "LyricInput",
    keyboardEvent: event,
  });
};

const onLyricInputBlur = () => {
  stateMachineProcess({
    type: "blurEvent",
    targetArea: "LyricInput",
  });
};

const onPointerEnter = () => {
  showGuideLine.value = true;
};

const onPointerLeave = () => {
  showGuideLine.value = false;
};

// キーボードイベント
const handleNotesArrowUp = () => {
  const editedNotes: Note[] = [];
  for (const note of selectedNotes.value) {
    const noteNumber = Math.min(note.noteNumber + 1, 127);
    editedNotes.push({ ...note, noteNumber });
  }
  if (editedNotes.some((note) => note.noteNumber > 127)) {
    return;
  }
  void store.actions.COMMAND_UPDATE_NOTES({
    notes: editedNotes,
    trackId: selectedTrackId.value,
  });

  if (editedNotes.length === 1) {
    void store.actions.PLAY_PREVIEW_SOUND({
      noteNumber: editedNotes[0].noteNumber,
      duration: PREVIEW_SOUND_DURATION,
    });
  }
};

const handleNotesArrowDown = () => {
  const editedNotes: Note[] = [];
  for (const note of selectedNotes.value) {
    const noteNumber = Math.max(note.noteNumber - 1, 0);
    editedNotes.push({ ...note, noteNumber });
  }
  if (editedNotes.some((note) => note.noteNumber < 0)) {
    return;
  }
  void store.actions.COMMAND_UPDATE_NOTES({
    notes: editedNotes,
    trackId: selectedTrackId.value,
  });

  if (editedNotes.length === 1) {
    void store.actions.PLAY_PREVIEW_SOUND({
      noteNumber: editedNotes[0].noteNumber,
      duration: PREVIEW_SOUND_DURATION,
    });
  }
};

const handleNotesArrowRight = () => {
  const editedNotes: Note[] = [];
  for (const note of selectedNotes.value) {
    const position = note.position + snapTicks.value;
    editedNotes.push({ ...note, position });
  }
  if (editedNotes.length === 0) {
    // TODO: 例外処理は`UPDATE_NOTES`内に移す？
    return;
  }
  void store.actions.COMMAND_UPDATE_NOTES({
    notes: editedNotes,
    trackId: selectedTrackId.value,
  });
};

const handleNotesArrowLeft = () => {
  const editedNotes: Note[] = [];
  for (const note of selectedNotes.value) {
    const position = note.position - snapTicks.value;
    editedNotes.push({ ...note, position });
  }
  if (
    editedNotes.length === 0 ||
    editedNotes.some((note) => note.position < 0)
  ) {
    return;
  }
  void store.actions.COMMAND_UPDATE_NOTES({
    notes: editedNotes,
    trackId: selectedTrackId.value,
  });
};

const handleNotesBackspaceOrDelete = () => {
  if (selectedNoteIds.value.size === 0) {
    // TODO: 例外処理は`COMMAND_REMOVE_SELECTED_NOTES`内に移す？
    return;
  }
  void store.actions.COMMAND_REMOVE_SELECTED_NOTES();
};

const handleKeydown = (event: KeyboardEvent) => {
  stateMachineProcess({
    type: "keyboardEvent",
    targetArea: "Document",
    keyboardEvent: event,
  });

  // プレビュー中の操作は想定外の挙動をしそうなので防止
  if (nowPreviewing.value) {
    return;
  }
  switch (event.key) {
    case "ArrowUp":
      handleNotesArrowUp();
      break;
    case "ArrowDown":
      handleNotesArrowDown();
      break;
    case "ArrowRight":
      handleNotesArrowRight();
      break;
    case "ArrowLeft":
      handleNotesArrowLeft();
      break;
    case "Backspace":
      handleNotesBackspaceOrDelete();
      break;
    case "Delete":
      handleNotesBackspaceOrDelete();
      break;
    case "Escape":
      void store.actions.DESELECT_ALL_NOTES();
      break;
  }
};

const handleKeyUp = (event: KeyboardEvent) => {
  stateMachineProcess({
    type: "keyboardEvent",
    targetArea: "Document",
    keyboardEvent: event,
  });
};

// X軸ズーム
const setZoomX = (value: number | null) => {
  if (value == null) {
    return;
  }
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  // 画面の中央を基準に水平方向のズームを行う
  const oldZoomX = zoomX.value;
  const newZoomX = value;
  const scrollLeft = sequencerBodyElement.scrollLeft;
  const scrollTop = sequencerBodyElement.scrollTop;
  const clientWidth = sequencerBodyElement.clientWidth;

  void store.actions.SET_ZOOM_X({ zoomX: newZoomX }).then(() => {
    const centerBaseX = (scrollLeft + clientWidth / 2) / oldZoomX;
    const newScrollLeft = centerBaseX * newZoomX - clientWidth / 2;
    sequencerBodyElement.scrollTo(newScrollLeft, scrollTop);
  });
};

// Y軸ズーム
const setZoomY = (value: number | null) => {
  if (value == null) {
    return;
  }
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  // 画面の中央を基準に垂直方向のズームを行う
  const oldZoomY = zoomY.value;
  const newZoomY = value;
  const scrollLeft = sequencerBodyElement.scrollLeft;
  const scrollTop = sequencerBodyElement.scrollTop;
  const clientHeight = sequencerBodyElement.clientHeight;

  void store.actions.SET_ZOOM_Y({ zoomY: newZoomY }).then(() => {
    const centerBaseY = (scrollTop + clientHeight / 2) / oldZoomY;
    const newScrollTop = centerBaseY * newZoomY - clientHeight / 2;
    sequencerBodyElement.scrollTo(scrollLeft, newScrollTop);
  });
};

const panTimelineBy = (deltaX: number) => {
  const el = sequencerBody.value;
  assertNonNullable(el);
  el.scrollBy(deltaX, 0);
};

const zoomTimelineAt = (anchorX: number, deltaY: number) => {
  const el = sequencerBody.value;
  assertNonNullable(el);
  const oldZoomX = zoomX.value;
  let newZoomX = oldZoomX - deltaY * (ZOOM_X_STEP * 0.01);
  newZoomX = Math.min(ZOOM_X_MAX, newZoomX);
  newZoomX = Math.max(ZOOM_X_MIN, newZoomX);
  const scrollLeft = el.scrollLeft;
  const scrollTop = el.scrollTop;

  void store.actions.SET_ZOOM_X({ zoomX: newZoomX }).then(() => {
    const cursorBaseX = (scrollLeft + anchorX) / oldZoomX;
    const newScrollLeft = cursorBaseX * newZoomX - anchorX;
    el.scrollTo(newScrollLeft, scrollTop);
  });
};

const onWheel = (event: WheelEvent) => {
  if (isOnCommandOrCtrlKeyDown(event)) {
    event.preventDefault();
    const sequencerBodyElement = sequencerBody.value;
    assertNonNullable(sequencerBodyElement);
    const cursorX = getXInBorderBox(event.clientX, sequencerBodyElement);
    zoomTimelineAt(cursorX, event.deltaY);
  }
};

const onScroll = (event: Event) => {
  if (!(event.currentTarget instanceof HTMLElement)) {
    throw new Error("event.currentTarget is not HTMLElement.");
  }
  scrollX.value = event.currentTarget.scrollLeft;
  scrollY.value = event.currentTarget.scrollTop;

  stateMachineProcess({
    type: "scrollEvent",
    targetArea: "SequencerBody",
  });
};

// オートスクロール
watch(playheadTicks, (newPlayheadPosition) => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    if (import.meta.env.DEV) {
      // HMR時にここにたどり着くことがあるので、開発時は警告だけにする
      // TODO: HMR時にここにたどり着く原因を調査して修正する
      warn("sequencerBodyElement is null.");
      return;
    }

    throw new Error("sequencerBodyElement is null.");
  }
  const scrollLeft = sequencerBodyElement.scrollLeft;
  const scrollTop = sequencerBodyElement.scrollTop;
  const scrollWidth = sequencerBodyElement.scrollWidth;
  const clientWidth = sequencerBodyElement.clientWidth;
  const playheadX = tickToBaseX(newPlayheadPosition, tpqn.value) * zoomX.value;
  const tolerance = 3;
  if (playheadX < scrollLeft) {
    sequencerBodyElement.scrollTo(playheadX, scrollTop);
  } else if (
    scrollLeft < scrollWidth - clientWidth - tolerance &&
    playheadX >= scrollLeft + clientWidth
  ) {
    sequencerBodyElement.scrollTo(playheadX, scrollTop);
  }
});

// スクロールバーの幅を取得する
onMounted(() => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  const clientWidth = sequencerBodyElement.clientWidth;
  const offsetWidth = sequencerBodyElement.offsetWidth;
  scrollBarWidth.value = offsetWidth - clientWidth;
});

// 最初のonActivatedか判断するためのフラグ
let firstActivation = true;

// スクロール位置を設定する
onActivated(() => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  let xToScroll = 0;
  let yToScroll = 0;
  if (firstActivation) {
    // 初期スクロール位置を設定（C4が上から2/3の位置になるようにする）
    const clientHeight = sequencerBodyElement.clientHeight;
    const c4BaseY = noteNumberToBaseY(60);
    const clientBaseHeight = clientHeight / zoomY.value;
    const scrollBaseY = c4BaseY - clientBaseHeight * (2 / 3);
    xToScroll = 0;
    yToScroll = scrollBaseY * zoomY.value;

    firstActivation = false;
  } else {
    // スクロール位置を復帰
    xToScroll = scrollX.value;
    yToScroll = scrollY.value;
  }
  // 実際にスクロールする
  void nextTick(() => {
    sequencerBodyElement.scrollTo(xToScroll, yToScroll);
  });
});

// リスナー登録
onActivated(() => {
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", handleKeyUp);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
});

// リスナー解除
onDeactivated(() => {
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("keyup", handleKeyUp);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
});

// コンテキストメニュー
// TODO: 分割する
const { registerHotkeyWithCleanup } = useHotkeyManager();

registerHotkeyWithCleanup({
  editor: "song",
  name: "コピー",
  callback: () => {
    if (nowPreviewing.value) {
      return;
    }
    if (selectedNoteIds.value.size === 0) {
      return;
    }
    void store.actions.COPY_NOTES_TO_CLIPBOARD();
  },
});

registerHotkeyWithCleanup({
  editor: "song",
  name: "切り取り",
  callback: () => {
    if (nowPreviewing.value) {
      return;
    }
    if (selectedNoteIds.value.size === 0) {
      return;
    }
    void store.actions.COMMAND_CUT_NOTES_TO_CLIPBOARD();
  },
});

registerHotkeyWithCleanup({
  editor: "song",
  name: "貼り付け",
  callback: () => {
    if (nowPreviewing.value) {
      return;
    }
    void store.actions.COMMAND_PASTE_NOTES_FROM_CLIPBOARD();
  },
});

registerHotkeyWithCleanup({
  editor: "song",
  name: "すべて選択",
  callback: () => {
    if (nowPreviewing.value) {
      return;
    }
    void store.actions.SELECT_ALL_NOTES_IN_TRACK({
      trackId: selectedTrackId.value,
    });
  },
});

const contextMenu = ref<InstanceType<typeof ContextMenu>>();

const contextMenuData = computed<ContextMenuItemData[]>(() => {
  // NOTE: 選択中のツールにはなんらかのアクティブな表示をしたほうがよいが、
  // activeなどの状態がContextMenuItemにはない+iconは画像なようなため状態表現はなし
  const toolMenuItems: ContextMenuItemData[] =
    editTarget.value === "NOTE"
      ? [
          {
            type: "button",
            label: "選択優先ツール",
            onClick: () => {
              contextMenu.value?.hide();
              void store.actions.SET_SEQUENCER_NOTE_TOOL({
                sequencerNoteTool: "SELECT_FIRST",
              });
            },
            disableWhenUiLocked: false,
          },
          {
            type: "button",
            label: "編集優先ツール",
            onClick: () => {
              contextMenu.value?.hide();
              void store.actions.SET_SEQUENCER_NOTE_TOOL({
                sequencerNoteTool: "EDIT_FIRST",
              });
            },
            disableWhenUiLocked: false,
          },
          { type: "separator" },
        ]
      : [
          {
            type: "button",
            label: "ピッチ描画ツール",
            onClick: () => {
              contextMenu.value?.hide();
              void store.actions.SET_SEQUENCER_PITCH_TOOL({
                sequencerPitchTool: "DRAW",
              });
            },
            disableWhenUiLocked: false,
          },
          {
            type: "button",
            label: "ピッチ削除ツール",
            onClick: () => {
              contextMenu.value?.hide();
              void store.actions.SET_SEQUENCER_PITCH_TOOL({
                sequencerPitchTool: "ERASE",
              });
            },
            disableWhenUiLocked: false,
          },
        ];

  const baseMenuItems: ContextMenuItemData[] = [
    {
      type: "button",
      label: "コピー",
      onClick: () => {
        contextMenu.value?.hide();
        void store.actions.COPY_NOTES_TO_CLIPBOARD();
      },
      disabled: !isNoteSelected.value,
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "切り取り",
      onClick: () => {
        contextMenu.value?.hide();
        void store.actions.COMMAND_CUT_NOTES_TO_CLIPBOARD();
      },
      disabled: !isNoteSelected.value,
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "貼り付け",
      onClick: () => {
        contextMenu.value?.hide();
        void store.actions.COMMAND_PASTE_NOTES_FROM_CLIPBOARD();
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "すべて選択",
      onClick: () => {
        contextMenu.value?.hide();
        void store.actions.SELECT_ALL_NOTES_IN_TRACK({
          trackId: selectedTrackId.value,
        });
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "選択解除",
      onClick: () => {
        contextMenu.value?.hide();
        void store.actions.DESELECT_ALL_NOTES();
      },
      disabled: !isNoteSelected.value,
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "クオンタイズ",
      onClick: () => {
        contextMenu.value?.hide();
        void store.actions.COMMAND_QUANTIZE_SELECTED_NOTES();
      },
      disabled: !isNoteSelected.value,
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "削除",
      onClick: () => {
        contextMenu.value?.hide();
        void store.actions.COMMAND_REMOVE_SELECTED_NOTES();
      },
      disabled: !isNoteSelected.value,
      disableWhenUiLocked: true,
    },
  ];

  return editTarget.value === "NOTE"
    ? [...toolMenuItems, ...baseMenuItems]
    : toolMenuItems;
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/colors" as colors;

.score-sequencer-shell {
  --editor-tool-rail-width: 48px;
  --sequencer-ruler-height: 40px;

  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.sequencer-full-playhead-layer {
  position: absolute;
  top: var(--sequencer-ruler-height);
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: calc(#{vars.$z-index-sing-ruler} - 1);
}

.sequencer-full-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: var(--scheme-color-inverse-surface);
  pointer-events: none;
  will-change: transform;
}

.tool-layout-docked .sequencer-full-playhead-layer,
.tool-layout-surface-strip .sequencer-full-playhead-layer,
.tool-layout-mode-context .sequencer-full-playhead-layer,
.tool-layout-header-rail .sequencer-full-playhead-layer {
  top: calc(36px + var(--sequencer-ruler-height));
}

.score-sequencer {
  backface-visibility: hidden;
  display: grid;
  grid-template-rows: var(--sequencer-ruler-height) 1fr;
  grid-template-columns: var(--editor-tool-rail-width) 48px minmax(0, 1fr);
  position: relative;
}

.tool-layout-sideRight .score-sequencer {
  min-width: 0;
  grid-template-columns: 48px minmax(0, 1fr);
  overflow: hidden;
}

.tool-layout-reserved-rail .score-sequencer {
  grid-template-columns:
    var(--editor-tool-rail-width) var(--editor-tool-rail-width) 48px
    minmax(0, 1fr);
}

.tool-layout-docked .score-sequencer,
.tool-layout-surface-strip .score-sequencer {
  --piano-roll-dock-height: 36px;

  grid-template-rows:
    var(--piano-roll-dock-height) var(--sequencer-ruler-height)
    1fr;
  grid-template-columns: 48px minmax(0, 1fr);
}

.tool-layout-header-rail .score-sequencer {
  grid-template-rows: 36px var(--sequencer-ruler-height) 1fr;
  grid-template-columns: var(--editor-tool-rail-width) 48px minmax(0, 1fr);
}

.tool-layout-mode-context .score-sequencer {
  grid-template-rows: 36px var(--sequencer-ruler-height) 1fr;
  grid-template-columns: var(--editor-tool-rail-width) 48px minmax(0, 1fr);
}

.piano-roll-toolbar {
  grid-row: 1 / -1;
  grid-column: 1 / -1;
  display: grid;
  grid-template-rows: var(--sequencer-ruler-height) 1fr;
  grid-template-columns: var(--editor-tool-rail-width) 48px minmax(0, 1fr);
  pointer-events: none;
  z-index: calc(#{vars.$z-index-sing-playhead} + 2);
}

.tool-layout-sideRight .piano-roll-toolbar {
  min-width: 0;
  grid-template-columns: 48px minmax(0, 1fr);
}

.tool-layout-reserved-rail .piano-roll-toolbar {
  grid-template-columns:
    var(--editor-tool-rail-width) var(--editor-tool-rail-width) 48px
    minmax(0, 1fr);
}

.piano-roll-mode-zone {
  grid-row: 1 / -1;
  grid-column: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  padding-top: 0;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-low) 74%,
    transparent
  );
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 50%, transparent);
}

.tool-layout-sideRight .piano-roll-mode-zone {
  box-sizing: border-box;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--editor-tool-rail-width);
  align-items: flex-start;
  z-index: 3;
  border-right: 0;
  border-left: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 50%, transparent);
}

.piano-roll-tool-zone {
  grid-row: 1 / -1;
  grid-column: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-top: 6px;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-low) 44%,
    transparent
  );
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 42%, transparent);
  pointer-events: auto;
}

.tool-layout-docked .piano-roll-toolbar {
  grid-row: 1;
  grid-column: 1 / -1;
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 2px 8px 0 56px;
}

.tool-layout-surface-strip .piano-roll-toolbar {
  grid-row: 1;
  grid-column: 1 / -1;
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 2px 12px 0 56px;
  background: color-mix(in oklch, var(--scheme-color-surface) 94%, transparent);
  border-bottom: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 36%, transparent);
}

.tool-layout-header-rail .piano-roll-toolbar {
  grid-row: 1 / -1;
  grid-column: 1 / -1;
  grid-template-rows: 36px var(--sequencer-ruler-height) 1fr;
  grid-template-columns: var(--editor-tool-rail-width) 48px minmax(0, 1fr);
}

.tool-layout-mode-context .piano-roll-toolbar {
  grid-row: 1 / -1;
  grid-column: 1 / -1;
  grid-template-rows: 36px var(--sequencer-ruler-height) 1fr;
  grid-template-columns: var(--editor-tool-rail-width) 48px minmax(0, 1fr);
}

.surface-command-title {
  color: var(--scheme-color-on-surface-variant);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  pointer-events: auto;
}

.tool-layout-command-bar .surface-command-title {
  display: grid;
  place-items: center;
  height: 24px;
  padding: 0 10px;
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 52%, transparent);
}

.tool-layout-docked .piano-roll-mode-zone {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding-top: 0;
  background: transparent;
  border-right: 0;
}

.tool-layout-surface-strip .piano-roll-mode-zone {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding-top: 0;
  background: transparent;
  border-right: 0;
}

.tool-layout-header-rail .piano-roll-mode-zone {
  grid-row: 1;
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 2px 8px 0 88px;
  background: transparent;
  border-right: 0;
}

.tool-layout-mode-context .piano-roll-mode-zone {
  grid-row: 1 / -1;
  grid-column: 1;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  padding-top: 0;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-low) 74%,
    transparent
  );
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 50%, transparent);
}

.tool-layout-proposalB .piano-roll-mode-zone {
  gap: 14px;
}

.piano-roll-mode-zone,
.piano-roll-floating-tools,
.piano-roll-tool-zone,
.piano-roll-context-strip,
.piano-roll-context-hud,
.piano-roll-current-tool-zone,
.piano-roll-command-button {
  pointer-events: auto;
}

.piano-roll-context-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 8px;
  border-radius: 7px;
  background: color-mix(in oklch, var(--scheme-color-surface) 94%, transparent);
  box-shadow: 0 1px 3px oklch(0% 0 0 / 0.12);
}

.tool-layout-mode-context .piano-roll-context-strip {
  grid-row: 1;
  grid-column: 2 / -1;
  align-self: center;
  justify-self: start;
  margin-left: 8px;
}

.context-strip-target,
.context-hud-label {
  color: var(--scheme-color-on-surface-variant);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.tool-layout-context-hud .piano-roll-toolbar {
  position: relative;
}

.piano-roll-context-hud {
  position: absolute;
  top: 52px;
  left: calc(var(--editor-tool-rail-width) + 48px + 12px);
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 1px 8px 1px 10px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 44%, transparent);
  border-radius: 4px;
  background: color-mix(in oklch, var(--scheme-color-surface) 90%, transparent);
  box-shadow: 0 6px 18px oklch(0% 0 0 / 0.16);
  backdrop-filter: blur(6px);
}

.piano-roll-current-tool-zone {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}

.current-tool-chip,
.command-palette-button,
.piano-roll-command-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 42%, transparent);
  border-radius: 7px;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-lowest) 94%,
    transparent
  );
  color: color-mix(
    in oklch,
    var(--scheme-color-on-surface-variant) 78%,
    var(--scheme-color-primary)
  );
  box-shadow: 0 2px 6px oklch(0% 0 0 / 0.08);
  cursor: pointer;

  &:hover {
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container-highest) 74%,
      transparent
    );
    color: var(--scheme-color-on-surface);
  }
}

.current-tool-chip {
  gap: 6px;
  min-width: 104px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
}

.command-palette-button,
.piano-roll-command-button {
  width: 32px;
  padding: 0;
}

.current-tool-chip .material-symbols-rounded,
.command-palette-button .material-symbols-rounded,
.piano-roll-command-button .material-symbols-rounded {
  font-size: 18px;
  line-height: 1;
}

.tool-chip-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-2px);
  transition:
    opacity 0.12s ease-out,
    transform 0.12s ease-out;
  z-index: 2;
}

.piano-roll-current-tool-zone:hover .tool-chip-popover,
.piano-roll-current-tool-zone:focus-within .tool-chip-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.piano-roll-floating-tools {
  pointer-events: auto;
}

.piano-roll-floating-tools.layout-center {
  grid-row: 1;
  grid-column: 3;
  align-self: center;
  justify-self: center;
}

.piano-roll-floating-tools.layout-centerBottom {
  grid-row: 2;
  grid-column: 3;
  align-self: end;
  justify-self: center;
  margin-bottom: 12px;
}

.piano-roll-floating-tools.layout-proposalA,
.piano-roll-floating-tools.layout-proposalD {
  grid-row: 1 / -1;
  grid-column: 1 / -1;
  align-self: start;
  justify-self: start;
  margin: 6px 0 0 calc(var(--editor-tool-rail-width) + 6px);
}

.piano-roll-floating-tools.layout-proposalA.active-target-pitch,
.piano-roll-floating-tools.layout-proposalD.active-target-pitch {
  margin-top: 40px;
}

.piano-roll-floating-tools.layout-proposalC {
  grid-row: 2 / -1;
  grid-column: 1;
  align-self: start;
  justify-self: center;
  margin-top: 6px;
}

.tool-layout-proposalD .piano-roll-floating-tools {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-4px);
  transition:
    opacity 0.12s ease-out,
    transform 0.12s ease-out;
}

.tool-layout-proposalD .piano-roll-mode-zone:hover ~ .piano-roll-floating-tools,
.tool-layout-proposalD .piano-roll-floating-tools:hover,
.tool-layout-proposalD
  .piano-roll-mode-zone:focus-within
  ~ .piano-roll-floating-tools,
.tool-layout-proposalD .piano-roll-floating-tools:focus-within {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

.piano-roll-floating-tools.layout-dockCenter {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.piano-roll-floating-tools.layout-side {
  grid-row: 1 / -1;
  grid-column: 1 / -1;
  align-self: start;
  justify-self: end;
  margin: 48px 12px 0 0;
}

.piano-roll-floating-tools.layout-sideRight {
  position: absolute;
  top: 48px;
  right: calc(var(--editor-tool-rail-width) + 12px);
  margin: 0;
}

.piano-roll-floating-tools.layout-sideLeftToolbarRight {
  grid-row: 1 / -1;
  grid-column: 1 / -1;
  align-self: start;
  justify-self: end;
  margin: 48px 12px 0 0;
}

.piano-roll-floating-tools.layout-sideLeft {
  grid-row: 1 / -1;
  grid-column: 1 / -1;
  align-self: start;
  justify-self: start;
  margin: 48px 0 0 calc(var(--editor-tool-rail-width) + 54px);
}

.piano-roll-edit-target-tabs {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  width: 48px;
  padding: 4px;
  background: transparent;
  pointer-events: auto;
}

.tool-layout-docked .piano-roll-edit-target-tabs,
.tool-layout-surface-strip .piano-roll-edit-target-tabs,
.tool-layout-header-rail .piano-roll-edit-target-tabs {
  flex-direction: row;
  align-items: center;
  gap: 0;
  width: auto;
  padding: 1px;
  border-radius: 7px;
  background: var(--scheme-color-surface);
  box-shadow: 0 1px 3px oklch(0% 0 0 / 0.14);
}

.tool-layout-docked .piano-roll-edit-target-tab,
.tool-layout-surface-strip .piano-roll-edit-target-tab,
.tool-layout-header-rail .piano-roll-edit-target-tab {
  width: auto;
  min-width: 50px;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
}

.tool-layout-docked .piano-roll-edit-target-tab,
.tool-layout-surface-strip .piano-roll-edit-target-tab {
  border: 0;
  border-radius: 5px;
}

.tool-layout-docked .piano-roll-edit-target-tab.active,
.tool-layout-surface-strip .piano-roll-edit-target-tab.active,
.tool-layout-header-rail .piano-roll-edit-target-tab.active {
  background: color-mix(
    in oklch,
    var(--scheme-color-secondary-container) 72%,
    var(--scheme-color-surface)
  );
  color: var(--scheme-color-on-secondary-container);
  font-weight: 700;
  box-shadow:
    inset 0 0 0 1px
      color-mix(in oklch, var(--scheme-color-secondary) 38%, transparent),
    0 1px 2px oklch(0% 0 0 / 0.1);
}

.tool-layout-inspector-header .piano-roll-toolbar {
  padding-left: 48px;
  background: var(--scheme-color-surface-container-low);
}

.tool-layout-inspector-header .piano-roll-edit-target-tabs {
  align-self: stretch;
  gap: 6px;
  height: 34px;
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.tool-layout-inspector-header .piano-roll-edit-target-tab {
  min-width: 68px;
  height: 34px;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.tool-layout-inspector-header .piano-roll-edit-target-tab.active {
  border-bottom: 2px solid var(--scheme-color-secondary);
  background: transparent;
  color: var(--scheme-color-on-surface);
  box-shadow: none;
}

.tool-layout-command-bar .piano-roll-toolbar {
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-lowest) 96%,
    transparent
  );
}

.tool-layout-command-bar .piano-roll-mode-zone {
  padding-left: 2px;
}

.piano-roll-edit-target-tab {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  position: relative;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--scheme-color-on-surface-variant);
  cursor: pointer;

  &:hover {
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container-highest) 68%,
      transparent
    );
    color: var(--scheme-color-on-surface);
  }

  &.active {
    z-index: 1;
    background: var(--scheme-color-secondary-container);
    color: var(--scheme-color-on-secondary-container);
    box-shadow: none;
  }

  .material-symbols-rounded {
    font-size: 20px;
    font-variation-settings: "FILL" 1;
    line-height: 1;
  }
}

.edit-target-button-content {
  display: grid;
  place-items: center;
  gap: 2px;
  line-height: 1;
}

.edit-target-button-label {
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.tool-layout-sideRight .piano-roll-edit-target-tab {
  border-radius: 8px;

  &.active {
    box-shadow: none;
  }
}

.piano-roll-snap-control {
  grid-row: 1;
  grid-column: 3;
  justify-self: end;
  align-self: center;
  margin-left: auto;
  margin-right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 4px 0 8px;
  border-radius: 6px;
  color: var(--scheme-color-on-surface-variant);
  font-size: 12px;
  font-weight: 500;
  background: color-mix(in oklch, var(--scheme-color-surface) 86%, transparent);
  box-shadow: 0 2px 6px oklch(0% 0 0 / 0.08);
  pointer-events: auto;

  &:hover {
    background: var(--scheme-color-surface-container-highest);
  }
}

.tool-layout-reserved-rail .piano-roll-snap-control {
  grid-column: 4;
}

.tool-layout-sideRight .piano-roll-snap-control {
  grid-column: 2;
  margin-right: 12px;
  transform: translateX(calc(-1 * var(--editor-tool-rail-width)));
}

.tool-layout-docked .piano-roll-snap-control {
  margin-left: auto;
  margin-right: 4px;
}

.tool-layout-surface-strip .piano-roll-snap-control {
  margin-left: auto;
  margin-right: 0;
}

.tool-layout-command-bar .piano-roll-command-button {
  margin-left: auto;
}

.tool-layout-command-bar .piano-roll-snap-control {
  margin-left: 0;
}

.tool-layout-mode-context .piano-roll-snap-control {
  grid-row: 1;
  grid-column: 3;
  margin-left: auto;
  margin-right: 12px;
}

.tool-layout-header-rail .piano-roll-snap-control {
  grid-row: 1;
  grid-column: 3;
  margin-left: auto;
  margin-right: 12px;
}

.piano-roll-snap-label {
  line-height: 1;
}

.piano-roll-snap-select {
  height: 22px;
  min-width: 62px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--scheme-color-on-surface);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  outline: none;
  cursor: pointer;
}

.tool-layout-switcher {
  position: fixed;
  top: 50%;
  right: 0;
  display: flex;
  align-items: center;
  transform: translate(calc(100% - 10px), -50%);
  opacity: 0;
  transition: transform 0.12s ease-out;
  z-index: calc(#{vars.$z-index-sing-playhead} + 4);

  &:hover,
  &:focus-within {
    transform: translate(0, -50%);
    opacity: 1;
  }
}

.tool-layout-switcher-grip {
  width: 10px;
  height: 56px;
  border-radius: 6px 0 0 6px;
  background: color-mix(
    in oklch,
    var(--scheme-color-outline-variant) 54%,
    var(--scheme-color-surface)
  );
  box-shadow: 0 2px 6px oklch(0% 0 0 / 0.08);
}

.tool-layout-switcher-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 42%, transparent);
  border-radius: 7px 0 0 7px;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-lowest) 94%,
    transparent
  );
  box-shadow: 0 4px 12px oklch(0% 0 0 / 0.12);
}

.tool-layout-switcher-section-label {
  padding: 4px 6px 2px;
  color: var(--scheme-color-on-surface-variant);
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.tool-layout-switcher-section-label:not(:first-child) {
  margin-top: 4px;
  border-top: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 40%, transparent);
}

.tool-layout-switch {
  min-width: 132px;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: color-mix(
    in oklch,
    var(--scheme-color-on-surface-variant) 82%,
    var(--scheme-color-primary)
  );
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: var(--scheme-color-surface-container-highest);
    color: var(--scheme-color-on-surface);
  }

  &.active {
    background: var(--scheme-color-surface);
    color: var(--scheme-color-on-surface);
    box-shadow: inset 0 0 0 1px
      color-mix(in oklch, var(--scheme-color-primary) 34%, transparent);
  }
}

.sequencer-corner {
  grid-row: 1;
  grid-column: 2;
  position: relative;
  background: var(--scheme-color-sing-ruler-surface);
  z-index: vars.$z-index-sing-ruler;
}

.tool-layout-sideRight .sequencer-corner {
  grid-column: 1;
}

.tool-layout-reserved-rail .sequencer-corner {
  grid-column: 3;
}

.tool-layout-docked .sequencer-corner,
.tool-layout-surface-strip .sequencer-corner {
  grid-row: 2;
  grid-column: 1;
}

.tool-layout-header-rail .sequencer-corner,
.tool-layout-mode-context .sequencer-corner {
  grid-row: 2;
  grid-column: 2;
}

.sequencer-ruler {
  grid-row: 1;
  grid-column: 3;
}

.tool-layout-sideRight .sequencer-ruler {
  grid-column: 2;
}

.tool-layout-reserved-rail .sequencer-ruler {
  grid-column: 4;
}

.tool-layout-docked .sequencer-ruler,
.tool-layout-surface-strip .sequencer-ruler {
  grid-row: 2;
  grid-column: 2;
}

.tool-layout-header-rail .sequencer-ruler,
.tool-layout-mode-context .sequencer-ruler {
  grid-row: 2;
  grid-column: 3;
}

.sequencer-keys {
  grid-row: 2;
  grid-column: 2;
  position: relative;
  z-index: vars.$z-index-sing-ruler;
}

.tool-layout-sideRight .sequencer-keys {
  grid-column: 1;
}

.tool-layout-reserved-rail .sequencer-keys {
  grid-column: 3;
}

.tool-layout-docked .sequencer-keys,
.tool-layout-surface-strip .sequencer-keys {
  grid-row: 3;
  grid-column: 1;
}

.tool-layout-header-rail .sequencer-keys,
.tool-layout-mode-context .sequencer-keys {
  grid-row: 3;
  grid-column: 2;
}

.sequencer-grid {
  grid-row: 2;
  grid-column: 3;
}

.tool-layout-sideRight .sequencer-grid {
  grid-column: 2;
  margin-right: 0 !important;
}

.tool-layout-reserved-rail .sequencer-grid {
  grid-column: 4;
}

.tool-layout-docked .sequencer-grid,
.tool-layout-surface-strip .sequencer-grid {
  grid-row: 3;
  grid-column: 2;
}

.tool-layout-header-rail .sequencer-grid,
.tool-layout-mode-context .sequencer-grid {
  grid-row: 3;
  grid-column: 3;
}

.sequencer-character-portrait {
  grid-row: 2;
  grid-column: 3;
}

.tool-layout-sideRight .sequencer-character-portrait {
  grid-column: 2;
  margin-right: 0 !important;
}

.tool-layout-reserved-rail .sequencer-character-portrait {
  grid-column: 4;
}

.tool-layout-docked .sequencer-character-portrait,
.tool-layout-surface-strip .sequencer-character-portrait {
  grid-row: 3;
  grid-column: 2;
}

.tool-layout-header-rail .sequencer-character-portrait,
.tool-layout-mode-context .sequencer-character-portrait {
  grid-row: 3;
  grid-column: 3;
}

.sequencer-guideline-container {
  grid-row: 2;
  grid-column: 3;
  position: relative;
  overflow: hidden;
  pointer-events: none;
}

.tool-layout-sideRight .sequencer-guideline-container {
  grid-column: 2;
  margin-right: 0 !important;
}

.tool-layout-reserved-rail .sequencer-guideline-container {
  grid-column: 4;
}

.tool-layout-docked .sequencer-guideline-container,
.tool-layout-surface-strip .sequencer-guideline-container {
  grid-row: 3;
  grid-column: 2;
}

.tool-layout-header-rail .sequencer-guideline-container,
.tool-layout-mode-context .sequencer-guideline-container {
  grid-row: 3;
  grid-column: 3;
}

.sequencer-guideline {
  left: -0.5px;
  width: 1px;
  height: 100%;
  background: var(--scheme-color-inverse-primary);
}

.sequencer-body {
  grid-row: 2;
  grid-column: 3;
  backface-visibility: hidden;
  overflow: auto;
  position: relative;
  touch-action: none;

  // スクロールバー上のカーソルが要素のものになってしまうためデフォルトカーソルにする
  &::-webkit-scrollbar {
    background-color: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: color-mix(
      in oklch,
      var(--scheme-color-outline-variant) 44%,
      transparent
    );
    background-clip: content-box;
    border: 3px solid transparent;
    border-radius: 999px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: color-mix(
      in oklch,
      var(--scheme-color-outline-variant) 68%,
      transparent
    );
  }

  &::-webkit-scrollbar-thumb:active {
    background-color: color-mix(
      in oklch,
      var(--scheme-color-outline-variant) 82%,
      transparent
    );
  }

  &::-webkit-scrollbar-corner {
    background-color: transparent;
  }

  &::-webkit-scrollbar-thumb:hover,
  &::-webkit-scrollbar-thumb:active,
  &::-webkit-scrollbar-track:hover,
  &::-webkit-scrollbar-track:active {
    cursor: default;
  }
}

.tool-layout-reserved-rail .sequencer-body {
  grid-column: 4;
}

.tool-layout-sideRight .sequencer-body {
  grid-column: 2;
}

.tool-layout-docked .sequencer-body,
.tool-layout-surface-strip .sequencer-body {
  grid-row: 3;
  grid-column: 2;
}

.tool-layout-header-rail .sequencer-body,
.tool-layout-mode-context .sequencer-body {
  grid-row: 3;
  grid-column: 3;
}

.sequencer-pitch {
  grid-row: 2;
  grid-column: 3;
}

.tool-layout-sideRight .sequencer-pitch {
  grid-column: 2;
  margin-right: 0 !important;
}

.tool-layout-reserved-rail .sequencer-pitch {
  grid-column: 4;
}

.tool-layout-docked .sequencer-pitch,
.tool-layout-surface-strip .sequencer-pitch {
  grid-row: 3;
  grid-column: 2;
}

.tool-layout-header-rail .sequencer-pitch,
.tool-layout-mode-context .sequencer-pitch {
  grid-row: 3;
  grid-column: 3;
}

.sequencer-overlay {
  grid-row: 2;
  grid-column: 3;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  pointer-events: none;
}

.tool-layout-sideRight .sequencer-overlay {
  grid-column: 2;
  margin-right: 0 !important;
}

.tool-layout-reserved-rail .sequencer-overlay {
  grid-column: 4;
}

.tool-layout-docked .sequencer-overlay,
.tool-layout-surface-strip .sequencer-overlay {
  grid-row: 3;
  grid-column: 2;
}

.tool-layout-header-rail .sequencer-overlay,
.tool-layout-mode-context .sequencer-overlay {
  grid-row: 3;
  grid-column: 3;
}

.sequencer-phrase-indicator {
  position: absolute;
  top: -2px;
  left: 0;
  height: 6px;
  border-radius: 2px;
}

.sequencer-playhead {
  position: absolute;
  top: 0;
  left: 0px;
  width: 2px;
  height: 100%;
  background: var(--scheme-color-inverse-surface);
  will-change: transform;
  transform: translate3d(0, 0, 0);
  z-index: calc(#{vars.$z-index-sing-tool-palette} - 1);
}

.rect-select-preview {
  display: block;
  pointer-events: none;
  position: absolute;
  border: 1px dashed var(--scheme-color-secondary);
  background: oklch(from var(--scheme-color-secondary) l c h / 0.1);
}

// TODO: ピッチ削除など消しゴム用のカーソル・画像がないためdefault
// カーソルが必要であれば画像を追加する
.cursor-erase {
  cursor: default;
}

.zoom-x-slider {
  position: absolute;
  bottom: 16px;
  right: 32px;
  width: 80px;

  :deep(.q-slider__track) {
    background: color-mix(
      in oklch,
      var(--scheme-color-outline-variant) 62%,
      transparent
    );
    color: color-mix(
      in oklch,
      var(--scheme-color-secondary) 86%,
      var(--scheme-color-on-surface)
    );
  }

  :deep(.q-slider__thumb) {
    color: color-mix(
      in oklch,
      var(--scheme-color-secondary) 86%,
      var(--scheme-color-on-surface)
    );
  }
}

.zoom-y-slider {
  position: absolute;
  bottom: 40px;
  right: 16px;
  height: 80px;

  :deep(.q-slider__track) {
    background: color-mix(
      in oklch,
      var(--scheme-color-outline-variant) 62%,
      transparent
    );
    color: color-mix(
      in oklch,
      var(--scheme-color-secondary) 86%,
      var(--scheme-color-on-surface)
    );
  }

  :deep(.q-slider__thumb) {
    color: color-mix(
      in oklch,
      var(--scheme-color-secondary) 86%,
      var(--scheme-color-on-surface)
    );
  }
}
</style>
