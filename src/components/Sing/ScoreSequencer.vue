<template>
  <QSplitter
    :modelValue="isParameterPanelOpen ? parameterPanelHeight : 0"
    reverse
    unit="px"
    horizontal
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
            previewing: nowPreviewing,
            [cursorClass]: true,
          }"
          aria-label="シーケンサ"
          @mousedown="onMouseDown"
          @mouseenter="onMouseEnter"
          @mouseleave="onMouseLeave"
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
            :previewLyric="previewLyrics.get(note.id) || null"
            :nowPreviewing
            :previewMode
            :cursorClass
            @barMousedown="onNoteBarMouseDown($event, note)"
            @barDoubleClick="onNoteBarDoubleClick($event, note)"
            @leftEdgeMousedown="onNoteLeftEdgeMouseDown($event, note)"
            @rightEdgeMousedown="onNoteRightEdgeMouseDown($event, note)"
          />
          <SequencerLyricInput
            v-if="editingLyricNote != undefined"
            :editingLyricNote
            @lyricInput="onLyricInput"
            @lyricConfirmed="onLyricConfirmed"
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
            ref="rectSelectHitbox"
            class="rect-select-preview"
            :style="{
              display: isRectSelecting ? 'block' : 'none',
              left: `${Math.min(rectSelectStartX, cursorX)}px`,
              top: `${Math.min(rectSelectStartY, cursorY)}px`,
              width: `${Math.abs(cursorX - rectSelectStartX)}px`,
              height: `${Math.abs(cursorY - rectSelectStartY)}px`,
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
              transform: `translateX(${playheadX - scrollX}px)`,
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
        <SequencerToolPalette
          :editTarget
          :sequencerNoteTool
          :sequencerPitchTool
          @update:sequencerNoteTool="
            (value) =>
              store.dispatch('SET_SEQUENCER_NOTE_TOOL', {
                sequencerNoteTool: value,
              })
          "
          @update:sequencerPitchTool="
            (value) =>
              store.dispatch('SET_SEQUENCER_PITCH_TOOL', {
                sequencerPitchTool: value,
              })
          "
        />
      </div>
    </template>
    <template #after>
      <SequencerParameterPanel v-if="isParameterPanelOpen" />
    </template>
  </QSplitter>
</template>

<script lang="ts">
import { ComputedRef } from "vue";
import type { InjectionKey } from "vue";

export const gridInfoInjectionKey: InjectionKey<{
  gridWidth: ComputedRef<number>;
  gridHeight: ComputedRef<number>;
}> = Symbol();
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
import SequencerParameterPanel from "./SequencerParameterPanel.vue";
import SequencerGridSpacer from "./SequencerGridSpacer.vue";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Container.vue";
import { NoteId } from "@/type/preload";
import { useStore } from "@/store";
import {
  Note,
  SequencerEditTarget,
  NoteEditTool,
  PitchEditTool,
} from "@/store/type";
import {
  getEndTicksOfPhrase,
  getMeasureDuration,
  getNoteDuration,
  getStartTicksOfPhrase,
  noteNumberToFrequency,
  tickToSecond,
} from "@/sing/domain";
import {
  tickToBaseX,
  baseXToTick,
  noteNumberToBaseY,
  baseYToNoteNumber,
  keyInfos,
  getDoremiFromNoteNumber,
  ZOOM_X_MIN,
  ZOOM_X_MAX,
  ZOOM_X_STEP,
  ZOOM_Y_MIN,
  ZOOM_Y_MAX,
  ZOOM_Y_STEP,
  PREVIEW_SOUND_DURATION,
  getButton,
  PreviewMode,
  MouseButton,
  MouseDownBehavior,
  MouseDoubleClickBehavior,
  CursorState,
  getKeyBaseHeight,
} from "@/sing/viewHelper";
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
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import { createLogger } from "@/helpers/log";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import {
  useCommandOrControlKey,
  useShiftKey,
} from "@/composables/useModifierKey";
import { applyGaussianFilter, linearInterpolation } from "@/sing/utility";
import { useLyricInput } from "@/composables/useLyricInput";
import { ExhaustiveError } from "@/type/utility";
import { uuid4 } from "@/helpers/random";

// 直接イベントが来ているかどうか
const isSelfEventTarget = (event: UIEvent) => {
  return event.target === event.currentTarget;
};

const { warn } = createLogger("ScoreSequencer");
const store = useStore();
const state = store.state;

// 選択中のトラックID
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);

// TPQN、テンポ、ノーツ
const tpqn = computed(() => state.tpqn);
const tempos = computed(() => state.tempos);
const notesInSelectedTrack = computed(() => store.getters.SELECTED_TRACK.notes);
const notesInOtherTracks = computed(() =>
  [...store.state.tracks.entries()].flatMap(([trackId, track]) =>
    trackId === selectedTrackId.value ? [] : track.notes,
  ),
);
const overlappingNoteIdsInSelectedTrack = computed(() =>
  store.getters.OVERLAPPING_NOTE_IDS(selectedTrackId.value),
);
const selectedNotes = computed(() =>
  store.getters.SELECTED_TRACK.notes.filter((note) =>
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

// 矩形選択
const shiftKey = useShiftKey();
const isRectSelecting = ref(false);
const rectSelectStartX = ref(0);
const rectSelectStartY = ref(0);
const rectSelectHitbox = ref<HTMLElement | undefined>(undefined);

// ズーム状態
const zoomX = computed(() => state.sequencerZoomX);
const zoomY = computed(() => state.sequencerZoomY);

// スナップ
const snapTicks = computed(() => {
  return getNoteDuration(state.sequencerSnapType, tpqn.value);
});

// 小節の数
const numMeasures = computed(() => {
  return store.getters.SEQUENCER_NUM_MEASURES;
});

// グリッド関係の値
const gridWidth = computed(() => {
  const timeSignatures = store.state.timeSignatures;
  const gridCellWidth = tickToBaseX(snapTicks.value, tpqn.value) * zoomX.value;

  let numOfGridColumns = 0;
  for (const [i, timeSignature] of timeSignatures.entries()) {
    const nextTimeSignature = timeSignatures[i + 1];
    const nextMeasureNumber =
      nextTimeSignature?.measureNumber ?? numMeasures.value + 1;
    const beats = timeSignature.beats;
    const beatType = timeSignature.beatType;
    const measureDuration = getMeasureDuration(beats, beatType, tpqn.value);
    numOfGridColumns +=
      Math.round(measureDuration / snapTicks.value) *
      (nextMeasureNumber - timeSignature.measureNumber);
  }
  return gridCellWidth * numOfGridColumns;
});
const gridHeight = computed(() => {
  const gridCellHeight = getKeyBaseHeight() * zoomY.value;
  return gridCellHeight * keyInfos.length;
});

provide(gridInfoInjectionKey, { gridWidth, gridHeight });

// スクロール位置
const scrollX = ref(0);
const scrollY = ref(0);

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

const parameterPanelHeight = ref(300);
const isParameterPanelOpen = computed(
  () => store.state.experimentalSetting.showParameterPanel,
);

const setParameterPanelHeight = (height: number) => {
  if (isParameterPanelOpen.value) {
    parameterPanelHeight.value = height;
  }
};

const ctrlKey = useCommandOrControlKey();
const editorFrameRate = computed(() => state.editorFrameRate);
const scrollBarWidth = ref(12);
const sequencerBody = ref<HTMLElement | null>(null);

// マウスカーソル位置
const cursorX = ref(0);
const cursorY = ref(0);

// 歌詞入力
const { previewLyrics, commitPreviewLyrics, splitAndUpdatePreview } =
  useLyricInput();

const onLyricInput = (text: string, note: Note) => {
  splitAndUpdatePreview(text, note);
};

const onLyricConfirmed = (nextNoteId: NoteId | undefined) => {
  commitPreviewLyrics();
  void store.actions.SET_EDITING_LYRIC_NOTE_ID({ noteId: nextNoteId });
};

// プレビュー
// FIXME: 関連する値を１つのobjectにまとめる
const previewMode = ref<PreviewMode>("IDLE");
const nowPreviewing = computed(() => previewMode.value !== "IDLE");
const executePreviewProcess = ref(false);
let previewRequestId = 0;
let previewStartEditTarget: SequencerEditTarget = "NOTE";
// ノート編集のプレビュー
// プレビュー中に更新（移動やリサイズ等）されるノーツ
const previewNotes = ref<Note[]>([]);
// プレビュー中に変更されない（プレビュー前の状態を保持する）ノーツ
const copiedNotesForPreview = new Map<NoteId, Note>();
const previewNoteIds = computed(() => {
  return new Set(nowPreviewing.value ? copiedNotesForPreview.keys() : []);
});
let dragStartTicks = 0;
let dragStartNoteNumber = 0;
let dragStartGuideLineTicks = 0;
let draggingNoteId = NoteId(""); // FIXME: 無効状態はstring以外の型にする
let edited = false; // プレビュー終了時にstore.stateの更新を行うかどうかを表す変数
// ピッチ編集のプレビュー
const previewPitchEdit = ref<
  | { type: "draw"; data: number[]; startFrame: number }
  | { type: "erase"; startFrame: number; frameLength: number }
  | undefined
>(undefined);
const prevCursorPos = { frame: 0, frequency: 0 }; // 前のカーソル位置

// 歌詞を編集中のノート
const editingLyricNote = computed(() => {
  return notesInSelectedTrack.value.find(
    (note) => note.id === state.editingLyricNoteId,
  );
});

// 入力を補助する線
const showGuideLine = ref(true);
const guideLineX = ref(0);

// 編集モード
// NOTE: ステートマシン実装後に削除する
// 議論 https://github.com/VOICEVOX/voicevox/pull/2367#discussion_r1853262865

// 編集モードの外部コンテキスト
interface EditModeContext {
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly nowPreviewing: boolean;
  readonly editTarget: SequencerEditTarget;
  readonly sequencerNoteTool: NoteEditTool;
  readonly sequencerPitchTool: PitchEditTool;
  readonly isSelfEventTarget?: boolean;
  readonly mouseButton?: MouseButton;
  readonly editingLyricNoteId?: NoteId;
}

// 編集対象
const editTarget = computed(() => store.state.sequencerEditTarget);
// 選択中のノート編集ツール
const sequencerNoteTool = computed(() => state.sequencerNoteTool);
// 選択中のピッチ編集ツール
const sequencerPitchTool = computed(() => state.sequencerPitchTool);

/**
 * マウスダウン時の振る舞いを判定する
 * 条件の判定のみを行い、実際の処理は呼び出し側で行う
 */
const determineMouseDownBehavior = (
  context: EditModeContext,
): MouseDownBehavior => {
  const { isSelfEventTarget, mouseButton, editingLyricNoteId } = context;

  // プレビュー中は無視
  if (nowPreviewing.value) return "IGNORE";

  // ノート編集の場合
  if (editTarget.value === "NOTE") {
    // イベントが来ていない場合は無視
    if (!isSelfEventTarget) return "IGNORE";
    // 歌詞編集中は無視
    if (editingLyricNoteId != undefined) return "IGNORE";

    // 左クリックの場合
    if (mouseButton === "LEFT_BUTTON") {
      // シフトキーが押されている場合は常に矩形選択開始
      if (shiftKey.value) return "START_RECT_SELECT";

      // 編集優先ツールの場合
      if (sequencerNoteTool.value === "EDIT_FIRST") {
        // コントロールキーが押されている場合は全選択解除
        if (ctrlKey.value) {
          return "DESELECT_ALL";
        }
        return "ADD_NOTE";
      }

      // 選択優先ツールの場合
      if (sequencerNoteTool.value === "SELECT_FIRST") {
        // 矩形選択開始
        return "START_RECT_SELECT";
      }
    }

    return "DESELECT_ALL";
  }

  // ピッチ編集の場合
  if (editTarget.value === "PITCH") {
    // 左クリック以外は無視
    if (mouseButton !== "LEFT_BUTTON") return "IGNORE";

    // ピッチ削除ツールが選択されている場合はピッチ削除
    if (sequencerPitchTool.value === "ERASE") {
      return "ERASE_PITCH";
    }

    // それ以外はピッチ編集
    return "DRAW_PITCH";
  }

  return "IGNORE";
};

/**
 * ダブルクリック時の振る舞いを判定する
 */
const determineDoubleClickBehavior = (
  context: EditModeContext,
): MouseDoubleClickBehavior => {
  const { isSelfEventTarget, mouseButton } = context;

  // ノート編集の場合
  if (editTarget.value === "NOTE") {
    // 直接イベントが来ていない場合は無視
    if (!isSelfEventTarget) return "IGNORE";

    // プレビュー中は無視
    if (nowPreviewing.value) return "IGNORE";

    // 選択優先ツールではノート追加
    if (mouseButton === "LEFT_BUTTON") {
      if (sequencerNoteTool.value === "SELECT_FIRST") {
        return "ADD_NOTE";
      }
    }
    return "IGNORE";
  }

  return "IGNORE";
};

// 以下のtoolChangedByCtrlは2024/12/04時点での期待動作が以下のため必要…
//
// DRAW選択時 → Ctrlキー押す → → Ctrlキー離す → DRAWに戻る
// ERASE選択時 → Ctrlキー押す → なにも起こらない(DRAWに変更されない)
//
// 単純にCtrlキーやPitchToolの新旧比較ではCtrlキー離されたときに常にツールがDRAWに戻ってしまうため
// 一時的な切り替えであることを保持しておく必要がある

// Ctrlキーが押されたときにピッチツールを変更したかどうか
const toolChangedByCtrl = ref(false);

// ピッチ編集モードにおいてCtrlキーが押されたときにピッチツールを消しゴムツールにする
watch([ctrlKey], () => {
  // ピッチ編集モードでない場合は無視
  if (editTarget.value !== "PITCH") {
    return;
  }

  // 現在のツールがピッチ描画ツールの場合
  if (sequencerPitchTool.value === "DRAW") {
    // Ctrlキーが押されたときはピッチ削除ツールに変更
    if (ctrlKey.value) {
      void store.actions.SET_SEQUENCER_PITCH_TOOL({
        sequencerPitchTool: "ERASE",
      });
      toolChangedByCtrl.value = true;
    }
  }

  // 現在のツールがピッチ削除ツールかつCtrlキーが離されたとき
  if (sequencerPitchTool.value === "ERASE" && toolChangedByCtrl.value) {
    // ピッチ描画ツールに戻す
    if (!ctrlKey.value) {
      void store.actions.SET_SEQUENCER_PITCH_TOOL({
        sequencerPitchTool: "DRAW",
      });
      toolChangedByCtrl.value = false;
    }
  }
});

// カーソルの状態
// TODO: ステートマシン実装後に削除する
// 議論 https://github.com/VOICEVOX/voicevox/pull/2367#discussion_r1853262865

/**
 * カーソルの状態を関連するコンテキストから取得する
 */
const determineCursorBehavior = (): CursorState => {
  // プレビューの場合
  if (nowPreviewing.value && previewMode.value !== "IDLE") {
    switch (previewMode.value) {
      case "ADD_NOTE":
        return "DRAW";
      case "MOVE_NOTE":
        return "MOVE";
      case "RESIZE_NOTE_RIGHT":
      case "RESIZE_NOTE_LEFT":
        return "EW_RESIZE";
      case "DRAW_PITCH":
        return "DRAW";
      case "ERASE_PITCH":
        return "ERASE";
      default:
        return "UNSET";
    }
  }

  // ノート編集の場合
  if (editTarget.value === "NOTE") {
    // シフトキーが押されていたら常に十字カーソル
    if (shiftKey.value) {
      return "CROSSHAIR";
    }
    // ノート編集ツールが選択されておりCtrlキーが押されていない場合は描画カーソル
    if (sequencerNoteTool.value === "EDIT_FIRST" && !ctrlKey.value) {
      return "DRAW";
    }
    // それ以外は未設定
    return "UNSET";
  }

  // ピッチ編集の場合
  if (editTarget.value === "PITCH") {
    // 描画ツールが選択されていたら描画カーソル
    if (sequencerPitchTool.value === "DRAW") {
      return "DRAW";
    }
    // 削除ツールが選択されていたら消しゴムカーソル
    if (sequencerPitchTool.value === "ERASE") {
      return "ERASE";
    }
  }
  return "UNSET";
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

// カーソルの状態
const cursorState = computed(() => determineCursorBehavior());

const previewAdd = () => {
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const draggingNote = copiedNotesForPreview.get(draggingNoteId);
  if (!draggingNote) {
    throw new Error("draggingNote is undefined.");
  }
  const dragTicks = cursorTicks - dragStartTicks;
  const noteDuration =
    Math.round(dragTicks / snapTicks.value) * snapTicks.value;
  const noteEndPos = draggingNote.position + noteDuration;

  const editedNotes = new Map<NoteId, Note>();
  for (const note of previewNotes.value) {
    const copiedNote = copiedNotesForPreview.get(note.id);
    if (!copiedNote) {
      throw new Error("copiedNote is undefined.");
    }
    const duration = Math.max(snapTicks.value, noteDuration);
    if (note.duration !== duration) {
      editedNotes.set(note.id, { ...note, duration });
    }
  }
  if (editedNotes.size !== 0) {
    previewNotes.value = previewNotes.value.map((value) => {
      return editedNotes.get(value.id) ?? value;
    });
  }

  const guideLineBaseX = tickToBaseX(noteEndPos, tpqn.value);
  guideLineX.value = guideLineBaseX * zoomX.value;
};

const previewMove = () => {
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorBaseY = (scrollY.value + cursorY.value) / zoomY.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const cursorNoteNumber = baseYToNoteNumber(cursorBaseY);
  const draggingNote = copiedNotesForPreview.get(draggingNoteId);
  if (!draggingNote) {
    throw new Error("draggingNote is undefined.");
  }
  const dragTicks = cursorTicks - dragStartTicks;
  const notePos = draggingNote.position;
  const newNotePos =
    Math.round((notePos + dragTicks) / snapTicks.value) * snapTicks.value;
  const movingTicks = newNotePos - notePos;
  const movingSemitones = cursorNoteNumber - dragStartNoteNumber;

  const editedNotes = new Map<NoteId, Note>();
  for (const note of previewNotes.value) {
    const copiedNote = copiedNotesForPreview.get(note.id);
    if (!copiedNote) {
      throw new Error("copiedNote is undefined.");
    }
    const position = copiedNote.position + movingTicks;
    const noteNumber = copiedNote.noteNumber + movingSemitones;
    if (note.position !== position || note.noteNumber !== noteNumber) {
      editedNotes.set(note.id, { ...note, noteNumber, position });
    }
  }
  for (const note of editedNotes.values()) {
    if (note.noteNumber < 0 || note.noteNumber >= keyInfos.length) {
      // MIDIキー範囲外へはドラッグしない
      return;
    }

    if (note.position < 0) {
      // 左端より前はドラッグしない
      return;
    }
  }
  if (editedNotes.size !== 0) {
    previewNotes.value = previewNotes.value.map((value) => {
      return editedNotes.get(value.id) ?? value;
    });
    edited = true;
  }

  const guideLineBaseX = tickToBaseX(
    dragStartGuideLineTicks + movingTicks,
    tpqn.value,
  );
  guideLineX.value = guideLineBaseX * zoomX.value;
};

const previewResizeRight = () => {
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const draggingNote = copiedNotesForPreview.get(draggingNoteId);
  if (!draggingNote) {
    throw new Error("draggingNote is undefined.");
  }
  const dragTicks = cursorTicks - dragStartTicks;
  const noteEndPos = draggingNote.position + draggingNote.duration;
  const newNoteEndPos =
    Math.round((noteEndPos + dragTicks) / snapTicks.value) * snapTicks.value;
  const movingTicks = newNoteEndPos - noteEndPos;

  const editedNotes = new Map<NoteId, Note>();
  for (const note of previewNotes.value) {
    const copiedNote = copiedNotesForPreview.get(note.id);
    if (!copiedNote) {
      throw new Error("copiedNote is undefined.");
    }
    const notePos = copiedNote.position;
    const noteEndPos = copiedNote.position + copiedNote.duration;
    const duration = Math.max(
      snapTicks.value,
      noteEndPos + movingTicks - notePos,
    );
    if (note.duration !== duration) {
      editedNotes.set(note.id, { ...note, duration });
    }
  }
  if (editedNotes.size !== 0) {
    previewNotes.value = previewNotes.value.map((value) => {
      return editedNotes.get(value.id) ?? value;
    });
    edited = true;
  }

  const guideLineBaseX = tickToBaseX(newNoteEndPos, tpqn.value);
  guideLineX.value = guideLineBaseX * zoomX.value;
};

const previewResizeLeft = () => {
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const draggingNote = copiedNotesForPreview.get(draggingNoteId);
  if (!draggingNote) {
    throw new Error("draggingNote is undefined.");
  }
  const dragTicks = cursorTicks - dragStartTicks;
  const notePos = draggingNote.position;
  const newNotePos =
    Math.round((notePos + dragTicks) / snapTicks.value) * snapTicks.value;
  const movingTicks = newNotePos - notePos;

  const editedNotes = new Map<NoteId, Note>();
  for (const note of previewNotes.value) {
    const copiedNote = copiedNotesForPreview.get(note.id);
    if (!copiedNote) {
      throw new Error("copiedNote is undefined.");
    }
    const notePos = copiedNote.position;
    const noteEndPos = copiedNote.position + copiedNote.duration;
    const position = Math.min(
      noteEndPos - snapTicks.value,
      notePos + movingTicks,
    );
    const duration = noteEndPos - position;
    if (note.position !== position && note.duration !== duration) {
      editedNotes.set(note.id, { ...note, position, duration });
    }
  }
  for (const note of editedNotes.values()) {
    if (note.position < 0) {
      // 左端より前はドラッグしない
      return;
    }
  }
  if (editedNotes.size !== 0) {
    previewNotes.value = previewNotes.value.map((value) => {
      return editedNotes.get(value.id) ?? value;
    });
    edited = true;
  }

  const guideLineBaseX = tickToBaseX(newNotePos, tpqn.value);
  guideLineX.value = guideLineBaseX * zoomX.value;
};

// ピッチを描く処理を行う
const previewDrawPitch = () => {
  if (previewPitchEdit.value == undefined) {
    throw new Error("previewPitchEdit.value is undefined.");
  }
  if (previewPitchEdit.value.type !== "draw") {
    throw new Error("previewPitchEdit.value.type is not draw.");
  }
  const frameRate = editorFrameRate.value;
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorBaseY = (scrollY.value + cursorY.value) / zoomY.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const cursorSeconds = tickToSecond(cursorTicks, tempos.value, tpqn.value);
  const cursorFrame = Math.round(cursorSeconds * frameRate);
  const cursorNoteNumber = baseYToNoteNumber(cursorBaseY, false);
  const cursorFrequency = noteNumberToFrequency(cursorNoteNumber);
  if (cursorFrame < 0) {
    return;
  }
  const tempPitchEdit = {
    ...previewPitchEdit.value,
    data: [...previewPitchEdit.value.data],
  };

  if (cursorFrame < tempPitchEdit.startFrame) {
    const numOfFramesToUnshift = tempPitchEdit.startFrame - cursorFrame;
    tempPitchEdit.data = new Array(numOfFramesToUnshift)
      .fill(0)
      .concat(tempPitchEdit.data);
    tempPitchEdit.startFrame = cursorFrame;
  }

  const lastFrame = tempPitchEdit.startFrame + tempPitchEdit.data.length - 1;
  if (cursorFrame > lastFrame) {
    const numOfFramesToPush = cursorFrame - lastFrame;
    tempPitchEdit.data = tempPitchEdit.data.concat(
      new Array(numOfFramesToPush).fill(0),
    );
  }

  if (cursorFrame === prevCursorPos.frame) {
    const i = cursorFrame - tempPitchEdit.startFrame;
    tempPitchEdit.data[i] = cursorFrequency;
  } else if (cursorFrame < prevCursorPos.frame) {
    for (let i = cursorFrame; i <= prevCursorPos.frame; i++) {
      tempPitchEdit.data[i - tempPitchEdit.startFrame] = Math.exp(
        linearInterpolation(
          cursorFrame,
          Math.log(cursorFrequency),
          prevCursorPos.frame,
          Math.log(prevCursorPos.frequency),
          i,
        ),
      );
    }
  } else {
    for (let i = prevCursorPos.frame; i <= cursorFrame; i++) {
      tempPitchEdit.data[i - tempPitchEdit.startFrame] = Math.exp(
        linearInterpolation(
          prevCursorPos.frame,
          Math.log(prevCursorPos.frequency),
          cursorFrame,
          Math.log(cursorFrequency),
          i,
        ),
      );
    }
  }

  previewPitchEdit.value = tempPitchEdit;
  prevCursorPos.frame = cursorFrame;
  prevCursorPos.frequency = cursorFrequency;
};

// ドラッグした範囲のピッチ編集データを消去する処理を行う
const previewErasePitch = () => {
  if (previewPitchEdit.value == undefined) {
    throw new Error("previewPitchEdit.value is undefined.");
  }
  if (previewPitchEdit.value.type !== "erase") {
    throw new Error("previewPitchEdit.value.type is not erase.");
  }
  const frameRate = editorFrameRate.value;
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const cursorSeconds = tickToSecond(cursorTicks, tempos.value, tpqn.value);
  const cursorFrame = Math.round(cursorSeconds * frameRate);
  if (cursorFrame < 0) {
    return;
  }
  const tempPitchEdit = { ...previewPitchEdit.value };

  if (tempPitchEdit.startFrame > cursorFrame) {
    tempPitchEdit.frameLength += tempPitchEdit.startFrame - cursorFrame;
    tempPitchEdit.startFrame = cursorFrame;
  }

  const lastFrame = tempPitchEdit.startFrame + tempPitchEdit.frameLength - 1;
  if (lastFrame < cursorFrame) {
    tempPitchEdit.frameLength += cursorFrame - lastFrame;
  }

  previewPitchEdit.value = tempPitchEdit;
  prevCursorPos.frame = cursorFrame;
};

const preview = () => {
  if (executePreviewProcess.value) {
    if (previewMode.value === "ADD_NOTE") {
      previewAdd();
    }
    if (previewMode.value === "MOVE_NOTE") {
      previewMove();
    }
    if (previewMode.value === "RESIZE_NOTE_RIGHT") {
      previewResizeRight();
    }
    if (previewMode.value === "RESIZE_NOTE_LEFT") {
      previewResizeLeft();
    }
    if (previewMode.value === "DRAW_PITCH") {
      previewDrawPitch();
    }
    if (previewMode.value === "ERASE_PITCH") {
      previewErasePitch();
    }
    executePreviewProcess.value = false;
  }
  previewRequestId = requestAnimationFrame(preview);
};

const getXInBorderBox = (clientX: number, element: HTMLElement) => {
  return clientX - element.getBoundingClientRect().left;
};

const getYInBorderBox = (clientY: number, element: HTMLElement) => {
  return clientY - element.getBoundingClientRect().top;
};

const selectOnlyThis = (note: Note) => {
  void store.actions.DESELECT_ALL_NOTES();
  void store.actions.SELECT_NOTES({ noteIds: [note.id] });
  void store.actions.PLAY_PREVIEW_SOUND({
    noteNumber: note.noteNumber,
    duration: PREVIEW_SOUND_DURATION,
  });
};

const startPreview = (event: MouseEvent, mode: PreviewMode, note?: Note) => {
  if (nowPreviewing.value) {
    warn("startPreview was called during preview.");
    return;
  }
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  cursorX.value = getXInBorderBox(event.clientX, sequencerBodyElement);
  cursorY.value = getYInBorderBox(event.clientY, sequencerBodyElement);
  if (cursorX.value >= sequencerBodyElement.clientWidth) {
    return;
  }
  if (cursorY.value >= sequencerBodyElement.clientHeight) {
    return;
  }
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorBaseY = (scrollY.value + cursorY.value) / zoomY.value;

  if (editTarget.value === "NOTE") {
    // 編集ターゲットがノートのときの処理

    const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
    const cursorNoteNumber = baseYToNoteNumber(cursorBaseY, true);
    // NOTE: 入力を補助する線の判定の境目はスナップ幅の3/4の位置
    const guideLineTicks =
      Math.round(cursorTicks / snapTicks.value - 0.25) * snapTicks.value;
    const copiedNotes: Note[] = [];
    if (mode === "ADD_NOTE") {
      if (cursorNoteNumber < 0) {
        return;
      }
      note = {
        id: NoteId(uuid4()),
        position: guideLineTicks,
        duration: snapTicks.value,
        noteNumber: cursorNoteNumber,
        lyric: getDoremiFromNoteNumber(cursorNoteNumber),
      };
      void store.actions.DESELECT_ALL_NOTES();
      copiedNotes.push(note);
    } else {
      if (!note) {
        throw new Error("note is undefined.");
      }
      if (event.shiftKey) {
        // Shiftキーが押されている場合は選択ノートまでの範囲選択
        let minIndex = notesInSelectedTrack.value.length - 1;
        let maxIndex = 0;
        for (let i = 0; i < notesInSelectedTrack.value.length; i++) {
          const noteId = notesInSelectedTrack.value[i].id;
          if (selectedNoteIds.value.has(noteId) || noteId === note.id) {
            minIndex = Math.min(minIndex, i);
            maxIndex = Math.max(maxIndex, i);
          }
        }
        const noteIdsToSelect: NoteId[] = [];
        for (let i = minIndex; i <= maxIndex; i++) {
          const noteId = notesInSelectedTrack.value[i].id;
          if (!selectedNoteIds.value.has(noteId)) {
            noteIdsToSelect.push(noteId);
          }
        }
        void store.actions.SELECT_NOTES({ noteIds: noteIdsToSelect });
      } else if (isOnCommandOrCtrlKeyDown(event)) {
        // CommandキーかCtrlキーが押されている場合
        if (selectedNoteIds.value.has(note.id)) {
          // 選択中のノートなら選択解除
          void store.actions.DESELECT_NOTES({ noteIds: [note.id] });
          return;
        }
        // 未選択のノートなら選択に追加
        void store.actions.SELECT_NOTES({ noteIds: [note.id] });
      } else if (!selectedNoteIds.value.has(note.id)) {
        // 選択中のノートでない場合は選択状態にする
        void selectOnlyThis(note);
      }
      for (const selectedNote of selectedNotes.value) {
        copiedNotes.push({ ...selectedNote });
      }
    }
    dragStartTicks = cursorTicks;
    dragStartNoteNumber = cursorNoteNumber;
    dragStartGuideLineTicks = guideLineTicks;
    draggingNoteId = note.id;
    edited = mode === "ADD_NOTE";
    copiedNotesForPreview.clear();
    for (const copiedNote of copiedNotes) {
      copiedNotesForPreview.set(copiedNote.id, copiedNote);
    }
    previewNotes.value = copiedNotes;
  } else if (editTarget.value === "PITCH") {
    // 編集ターゲットがピッチのときの処理

    const frameRate = editorFrameRate.value;
    const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
    const cursorSeconds = tickToSecond(cursorTicks, tempos.value, tpqn.value);
    const cursorFrame = Math.round(cursorSeconds * frameRate);
    const cursorNoteNumber = baseYToNoteNumber(cursorBaseY, false);
    const cursorFrequency = noteNumberToFrequency(cursorNoteNumber);
    if (mode === "DRAW_PITCH") {
      previewPitchEdit.value = {
        type: "draw",
        data: [cursorFrequency],
        startFrame: cursorFrame,
      };
    } else if (mode === "ERASE_PITCH") {
      previewPitchEdit.value = {
        type: "erase",
        startFrame: cursorFrame,
        frameLength: 1,
      };
    } else {
      throw new Error("Unknown preview mode.");
    }
    prevCursorPos.frame = cursorFrame;
    prevCursorPos.frequency = cursorFrequency;
  } else {
    throw new ExhaustiveError(editTarget.value);
  }
  previewMode.value = mode;
  previewStartEditTarget = editTarget.value;
  executePreviewProcess.value = true;
  previewRequestId = requestAnimationFrame(preview);
};

const endPreview = () => {
  cancelAnimationFrame(previewRequestId);
  if (previewStartEditTarget === "NOTE") {
    // 編集ターゲットがノートのときにプレビューを開始した場合の処理
    if (edited) {
      const previewTrackId = selectedTrackId.value;
      const noteIds = previewNotes.value.map((note) => note.id);

      if (previewMode.value === "ADD_NOTE") {
        void store.actions.COMMAND_ADD_NOTES({
          notes: previewNotes.value,
          trackId: previewTrackId,
        });
        void store.actions.SELECT_NOTES({
          noteIds,
        });
      } else if (
        previewMode.value === "MOVE_NOTE" ||
        previewMode.value === "RESIZE_NOTE_RIGHT" ||
        previewMode.value === "RESIZE_NOTE_LEFT"
      ) {
        // ノートの編集処理（移動・リサイズ）
        void store.actions.COMMAND_UPDATE_NOTES({
          notes: previewNotes.value,
          trackId: previewTrackId,
        });
        void store.actions.SELECT_NOTES({ noteIds });
      }
      if (previewNotes.value.length === 1) {
        void store.actions.PLAY_PREVIEW_SOUND({
          noteNumber: previewNotes.value[0].noteNumber,
          duration: PREVIEW_SOUND_DURATION,
        });
      }
    }
  } else if (previewStartEditTarget === "PITCH") {
    // 編集ターゲットがピッチのときにプレビューを開始した場合の処理

    if (previewPitchEdit.value == undefined) {
      throw new Error("previewPitchEdit.value is undefined.");
    }
    const previewPitchEditType = previewPitchEdit.value.type;
    if (previewPitchEditType === "draw") {
      // カーソルを動かさずにマウスのボタンを離したときに1フレームのみの変更になり、
      // 1フレームの変更はピッチ編集ラインとして表示されないので、無視する
      if (previewPitchEdit.value.data.length >= 2) {
        // 平滑化を行う
        let data = previewPitchEdit.value.data;
        data = data.map((value) => Math.log(value));
        applyGaussianFilter(data, 0.7);
        data = data.map((value) => Math.exp(value));

        void store.actions.COMMAND_SET_PITCH_EDIT_DATA({
          pitchArray: data,
          startFrame: previewPitchEdit.value.startFrame,
          trackId: selectedTrackId.value,
        });
      }
    } else if (previewPitchEditType === "erase") {
      void store.actions.COMMAND_ERASE_PITCH_EDIT_DATA({
        startFrame: previewPitchEdit.value.startFrame,
        frameLength: previewPitchEdit.value.frameLength,
        trackId: selectedTrackId.value,
      });
    } else {
      throw new ExhaustiveError(previewPitchEditType);
    }
    previewPitchEdit.value = undefined;
  } else {
    throw new ExhaustiveError(previewStartEditTarget);
  }
  previewMode.value = "IDLE";
  previewNotes.value = [];
  copiedNotesForPreview.clear();
  edited = false;
};

const onNoteBarMouseDown = (event: MouseEvent, note: Note) => {
  if (editTarget.value !== "NOTE" || !isSelfEventTarget(event)) {
    return;
  }

  const mouseButton = getButton(event);
  if (mouseButton === "LEFT_BUTTON") {
    startPreview(event, "MOVE_NOTE", note);
  } else if (!selectedNoteIds.value.has(note.id)) {
    selectOnlyThis(note);
  }
};

const onNoteBarDoubleClick = (event: MouseEvent, note: Note) => {
  if (editTarget.value !== "NOTE") {
    return;
  }
  const mouseButton = getButton(event);
  if (mouseButton === "LEFT_BUTTON" && note.id !== state.editingLyricNoteId) {
    void store.actions.SET_EDITING_LYRIC_NOTE_ID({ noteId: note.id });
  }
};

const onNoteLeftEdgeMouseDown = (event: MouseEvent, note: Note) => {
  if (editTarget.value !== "NOTE" || !isSelfEventTarget(event)) {
    return;
  }
  const mouseButton = getButton(event);
  if (mouseButton === "LEFT_BUTTON") {
    startPreview(event, "RESIZE_NOTE_LEFT", note);
  } else if (!selectedNoteIds.value.has(note.id)) {
    selectOnlyThis(note);
  }
};

const onNoteRightEdgeMouseDown = (event: MouseEvent, note: Note) => {
  if (editTarget.value !== "NOTE" || !isSelfEventTarget(event)) {
    return;
  }
  const mouseButton = getButton(event);
  if (mouseButton === "LEFT_BUTTON") {
    startPreview(event, "RESIZE_NOTE_RIGHT", note);
  } else if (!selectedNoteIds.value.has(note.id)) {
    selectOnlyThis(note);
  }
};

const onMouseDown = (event: MouseEvent) => {
  // TODO: isSelfEventTarget、mouseButton、editingLyricNoteId以外は必要ないが、
  // 必要な依存関係明示のため(とuseEditModeからのコピペのためcontextに入れている
  // ステートマシン実装時に要修正
  const mouseDownContext = {
    ctrlKey: ctrlKey.value,
    shiftKey: shiftKey.value,
    nowPreviewing: nowPreviewing.value,
    editTarget: editTarget.value,
    sequencerNoteTool: sequencerNoteTool.value,
    sequencerPitchTool: sequencerPitchTool.value,
    isSelfEventTarget: isSelfEventTarget(event),
    mouseButton: getButton(event),
    editingLyricNoteId: state.editingLyricNoteId,
  } satisfies EditModeContext;
  // マウスダウン時の振る舞い
  const behavior = determineMouseDownBehavior(mouseDownContext);

  switch (behavior) {
    case "IGNORE":
      return;

    case "START_RECT_SELECT":
      isRectSelecting.value = true;
      rectSelectStartX.value = cursorX.value;
      rectSelectStartY.value = cursorY.value;
      break;

    case "ADD_NOTE":
      startPreview(event, "ADD_NOTE");
      break;

    case "DESELECT_ALL":
      void store.actions.DESELECT_ALL_NOTES();
      break;

    case "DRAW_PITCH":
      startPreview(event, "DRAW_PITCH");
      break;

    case "ERASE_PITCH":
      startPreview(event, "ERASE_PITCH");
      break;

    default:
      break;
  }
};

const onMouseMove = (event: MouseEvent) => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  cursorX.value = getXInBorderBox(event.clientX, sequencerBodyElement);
  cursorY.value = getYInBorderBox(event.clientY, sequencerBodyElement);

  if (nowPreviewing.value) {
    executePreviewProcess.value = true;
  } else {
    const scrollLeft = sequencerBodyElement.scrollLeft;
    const cursorBaseX = (scrollLeft + cursorX.value) / zoomX.value;
    const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
    // NOTE: 入力を補助する線の判定の境目はスナップ幅の3/4の位置
    const guideLineTicks =
      Math.round(cursorTicks / snapTicks.value - 0.25) * snapTicks.value;
    const guideLineBaseX = tickToBaseX(guideLineTicks, tpqn.value);
    guideLineX.value = guideLineBaseX * zoomX.value;
  }
};

const onMouseUp = (event: MouseEvent) => {
  const mouseButton = getButton(event);
  if (mouseButton !== "LEFT_BUTTON") {
    return;
  }
  if (isRectSelecting.value) {
    rectSelect(isOnCommandOrCtrlKeyDown(event));
  } else if (nowPreviewing.value) {
    endPreview();
  }
};

const onDoubleClick = (event: MouseEvent) => {
  // TODO: isSelfEventTarget以外は必要ないが、
  // 必要な依存関係明示のため(とuseEditModeからのコピペのため)contextに入れている
  // ステートマシン実装時に要修正
  const mouseDoubleClickContext = {
    ctrlKey: ctrlKey.value,
    shiftKey: shiftKey.value,
    nowPreviewing: nowPreviewing.value,
    editTarget: editTarget.value,
    sequencerNoteTool: sequencerNoteTool.value,
    sequencerPitchTool: sequencerPitchTool.value,
    isSelfEventTarget: isSelfEventTarget(event),
    mouseButton: getButton(event),
  };

  const behavior = determineDoubleClickBehavior(mouseDoubleClickContext);

  // 振る舞いごとの処理
  switch (behavior) {
    case "IGNORE":
      return;

    case "ADD_NOTE": {
      startPreview(event, "ADD_NOTE");
      // ダブルクリックで追加した場合はプレビューを即終了しノートを追加する
      // mouseDownとの二重状態を避けるため
      endPreview();
      return;
    }

    default:
      break;
  }
};

/**
 * 矩形選択。
 * @param additive 追加選択とするかどうか。
 */
const rectSelect = (additive: boolean) => {
  const rectSelectHitboxElement = rectSelectHitbox.value;
  if (!rectSelectHitboxElement) {
    throw new Error("rectSelectHitboxElement is null.");
  }
  isRectSelecting.value = false;
  const left = Math.min(rectSelectStartX.value, cursorX.value);
  const top = Math.min(rectSelectStartY.value, cursorY.value);
  const width = Math.abs(cursorX.value - rectSelectStartX.value);
  const height = Math.abs(cursorY.value - rectSelectStartY.value);
  const startTicks = baseXToTick(
    (scrollX.value + left) / zoomX.value,
    tpqn.value,
  );
  const endTicks = baseXToTick(
    (scrollX.value + left + width) / zoomX.value,
    tpqn.value,
  );
  const endNoteNumber = baseYToNoteNumber((scrollY.value + top) / zoomY.value);
  const startNoteNumber = baseYToNoteNumber(
    (scrollY.value + top + height) / zoomY.value,
  );

  const noteIdsToSelect: NoteId[] = [];
  for (const note of notesInSelectedTrack.value) {
    if (
      note.position + note.duration >= startTicks &&
      note.position <= endTicks &&
      startNoteNumber <= note.noteNumber &&
      note.noteNumber <= endNoteNumber
    ) {
      noteIdsToSelect.push(note.id);
    }
  }
  if (!additive) {
    void store.actions.DESELECT_ALL_NOTES();
  }
  void store.actions.SELECT_NOTES({ noteIds: noteIdsToSelect });
};

const onMouseEnter = () => {
  showGuideLine.value = true;
};

const onMouseLeave = () => {
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

const onWheel = (event: WheelEvent) => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  if (isOnCommandOrCtrlKeyDown(event)) {
    // scrollイベントの発火を阻止する
    event.preventDefault();

    cursorX.value = getXInBorderBox(event.clientX, sequencerBodyElement);
    // マウスカーソル位置を基準に水平方向のズームを行う
    const oldZoomX = zoomX.value;
    let newZoomX = zoomX.value;
    newZoomX -= event.deltaY * (ZOOM_X_STEP * 0.01);
    newZoomX = Math.min(ZOOM_X_MAX, newZoomX);
    newZoomX = Math.max(ZOOM_X_MIN, newZoomX);
    const scrollLeft = sequencerBodyElement.scrollLeft;
    const scrollTop = sequencerBodyElement.scrollTop;
    guideLineX.value = 0; // 補助線がはみ出さないように位置を一旦0にする

    void store.actions.SET_ZOOM_X({ zoomX: newZoomX }).then(() => {
      const cursorBaseX = (scrollLeft + cursorX.value) / oldZoomX;
      const newScrollLeft = cursorBaseX * newZoomX - cursorX.value;
      sequencerBodyElement.scrollTo(newScrollLeft, scrollTop);
    });
  }
};

const onScroll = (event: Event) => {
  if (event.target instanceof HTMLElement) {
    scrollX.value = event.target.scrollLeft;
    scrollY.value = event.target.scrollTop;
  }
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
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
});

// リスナー解除
onDeactivated(() => {
  document.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
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

.score-sequencer {
  backface-visibility: hidden;
  display: grid;
  grid-template-rows: 40px 1fr;
  grid-template-columns: 48px 1fr;
  position: relative;
}

.sequencer-corner {
  grid-row: 1;
  grid-column: 1;
  background: var(--scheme-color-sing-ruler-surface);
  border-radius: 8px 0 0 0;
}

.sequencer-ruler {
  grid-row: 1;
  grid-column: 2;
}

.sequencer-keys {
  grid-row: 2;
  grid-column: 1;
}

.sequencer-grid {
  grid-row: 2;
  grid-column: 2;
}

.sequencer-character-portrait {
  grid-row: 2;
  grid-column: 2;
}

.sequencer-guideline-container {
  grid-row: 2;
  grid-column: 2;
  position: relative;
  overflow: hidden;
  pointer-events: none;
}

.sequencer-guideline {
  left: -0.5px;
  width: 1px;
  height: 100%;
  background: var(--scheme-color-inverse-primary);
}

.sequencer-body {
  grid-row: 2;
  grid-column: 2;
  backface-visibility: hidden;
  overflow: auto;
  position: relative;

  // スクロールバー上のカーソルが要素のものになってしまうためデフォルトカーソルにする
  &::-webkit-scrollbar-thumb:hover,
  &::-webkit-scrollbar-thumb:active,
  &::-webkit-scrollbar-track:hover,
  &::-webkit-scrollbar-track:active {
    cursor: default;
  }
}

.sequencer-pitch {
  grid-row: 2;
  grid-column: 2;
}

.sequencer-overlay {
  grid-row: 2;
  grid-column: 2;
  position: relative;
  overflow: hidden;
  pointer-events: none;
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
  z-index: vars.$z-index-sing-playhead;
}

.rect-select-preview {
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
    background: var(--scheme-color-outline-variant);
    color: var(--scheme-color-primary-fixed-dim);
  }

  :deep(.q-slider__thumb) {
    color: var(--scheme-color-primary-fixed-dim);
  }
}

.zoom-y-slider {
  position: absolute;
  bottom: 40px;
  right: 16px;
  height: 80px;

  :deep(.q-slider__track) {
    background: var(--scheme-color-outline-variant);
    color: var(--scheme-color-primary-fixed-dim);
  }

  :deep(.q-slider__thumb) {
    color: var(--scheme-color-primary-fixed-dim);
  }
}
</style>
