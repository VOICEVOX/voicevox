<template>
  <div class="phoneme-timing-editor">
    <div class="axis-area"></div>
    <div
      ref="parameterArea"
      class="parameter-area"
      :class="cursorClass"
      @pointerdown="onPointerDown"
      @dblclick="onDoubleClick"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
      @wheel="onWheel"
    >
      <SequencerParameterGrid class="parameter-grid" :viewportInfo />
      <template v-if="layout != undefined">
        <SequencerPhonemeTimings
          class="phoneme-timings"
          :viewportInfo
          :layout
          :previewPhonemeTiming
          :phonemeTimingInfos
          :activePhoneme
        />
        <SequencerNoteTimings
          class="note-timings"
          :viewportInfo
          :layout
          :activeNoteId="activePhoneme?.noteId"
        />
      </template>
      <SequencerPhonemeTimingToolPalette
        :sequencerPhonemeTimingTool
        @update:sequencerPhonemeTimingTool="setSequencerPhonemeTimingTool"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  getXInBorderBox,
  getYInBorderBox,
  type ViewportInfo,
} from "@/song/viewHelper";
import { useStore } from "@/store";
import { usePhonemeTimingEditorStateMachine } from "@/composables/usePhonemeTimingEditorStateMachine";
import {
  onMountedOrActivated,
  onUnmountedOrDeactivated,
} from "@/composables/onMountOrActivate";
import SequencerParameterGrid from "@/components/Song/SequencerParameterGrid.vue";
import SequencerPhonemeTimings from "@/components/Song/SequencerPhonemeTimings.vue";
import SequencerNoteTimings from "@/components/Song/SequencerNoteTimings.vue";
import SequencerPhonemeTimingToolPalette from "@/components/Song/SequencerPhonemeTimingToolPalette.vue";
import { getPhonemeTimingLayout } from "@/components/Song/SequencerPhonemeTimingEditor/style";
import { assertNonNullable } from "@/type/utility";
import {
  computePhonemeTimingInfos,
  getPhraseInfosForTrack,
} from "@/song/phonemeTimingEditorStateMachine/common";
import type { PhonemeTimingEditTool } from "@/store/type";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";

const store = useStore();
const sequencerPhonemeTimingTool = computed(
  () => store.state.sequencerPhonemeTimingTool,
);

const setSequencerPhonemeTimingTool = (tool: PhonemeTimingEditTool) => {
  void store.actions.SET_SEQUENCER_PHONEME_TIMING_TOOL({
    sequencerPhonemeTimingTool: tool,
  });
};

const props = defineProps<{
  viewportInfo: ViewportInfo;
}>();

const emit = defineEmits<{
  panTimeline: [deltaX: number];
  zoomTimeline: [anchorX: number, deltaY: number];
}>();

const viewportInfo = computed(() => props.viewportInfo);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const phonemeTimingEditData = computed(
  () => store.getters.SELECTED_TRACK.phonemeTimingEditData,
);
const phraseInfos = computed(() =>
  getPhraseInfosForTrack(
    store.state.phrases,
    store.state.phraseQueries,
    selectedTrackId.value,
  ),
);
const phonemeTimingInfos = computed(() => {
  return computePhonemeTimingInfos(
    phraseInfos.value,
    phonemeTimingEditData.value,
  );
});

const parameterArea = ref<HTMLElement | null>(null);
const parameterAreaHeight = ref<number>();

// ノート行・音素帯・ラベル行の縦位置は、描画と当たり判定で食い違わないようここで1回だけ求めて配る
const layout = computed(() =>
  parameterAreaHeight.value == undefined
    ? undefined
    : getPhonemeTimingLayout(parameterAreaHeight.value),
);
const phonemeBandYRange = computed(() => {
  assertNonNullable(layout.value);
  return {
    top: layout.value.bandTop,
    bottom: layout.value.bandTop + layout.value.bandHeight,
  };
});

const {
  stateMachineProcess,
  cursorState,
  previewMode,
  previewPhonemeTiming,
  activePhoneme,
} = usePhonemeTimingEditorStateMachine(
  store,
  viewportInfo,
  phonemeTimingInfos,
  phraseInfos,
  phonemeBandYRange,
);

const cursorClass = computed(() => {
  switch (cursorState.value) {
    case "EW_RESIZE":
      return "cursor-ew-resize";
    case "ERASE":
      return "cursor-erase";
    default:
      return "cursor-default";
  }
});

const getLocalPositionX = (event: MouseEvent): number => {
  const parameterAreaElement = parameterArea.value;
  assertNonNullable(parameterAreaElement);
  return getXInBorderBox(event.clientX, parameterAreaElement);
};

const getLocalPositionY = (event: MouseEvent): number => {
  const parameterAreaElement = parameterArea.value;
  assertNonNullable(parameterAreaElement);
  return getYInBorderBox(event.clientY, parameterAreaElement);
};

const onPointerDown = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "PhonemeTimingArea",
    pointerEvent: event,
    positionX: getLocalPositionX(event),
    positionY: getLocalPositionY(event),
  });
};

const onDoubleClick = (event: MouseEvent) => {
  stateMachineProcess({
    type: "mouseEvent",
    targetArea: "PhonemeTimingArea",
    mouseEvent: event,
    positionX: getLocalPositionX(event),
    positionY: getLocalPositionY(event),
  });
};

const onPointerMove = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "PhonemeTimingArea",
    pointerEvent: event,
    positionX: getLocalPositionX(event),
    positionY: getLocalPositionY(event),
  });
};

const onPointerLeave = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "PhonemeTimingArea",
    pointerEvent: event,
    positionX: getLocalPositionX(event),
    positionY: getLocalPositionY(event),
  });
};

const onWheel = (event: WheelEvent) => {
  // ドラッグ編集中はビューを動かさない
  if (previewMode.value !== "IDLE") {
    event.preventDefault();
    return;
  }

  // Ctrl/Cmd + ホイールは時間軸方向のズーム
  if (isOnCommandOrCtrlKeyDown(event)) {
    event.preventDefault();
    const parameterAreaElement = parameterArea.value;
    assertNonNullable(parameterAreaElement);
    const anchorX = getXInBorderBox(event.clientX, parameterAreaElement);
    emit("zoomTimeline", anchorX, event.deltaY);
    return;
  }

  // 横ホイールは時間軸方向のパン
  if (event.deltaX !== 0) {
    event.preventDefault();
    emit("panTimeline", event.deltaX);
    return;
  }

  // Shift + 縦ホイールも時間軸方向のパン
  if (event.shiftKey && event.deltaY !== 0) {
    event.preventDefault();
    emit("panTimeline", event.deltaY);
    return;
  }
};

const onWindowPointerMove = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "Window",
    pointerEvent: event,
    positionX: getLocalPositionX(event),
    positionY: getLocalPositionY(event),
  });
};

const onWindowPointerUp = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "Window",
    pointerEvent: event,
    positionX: getLocalPositionX(event),
    positionY: getLocalPositionY(event),
  });
};

const onWindowPointerCancel = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "Window",
    pointerEvent: event,
    positionX: getLocalPositionX(event),
    positionY: getLocalPositionY(event),
  });
};

let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
  const parameterAreaElement = parameterArea.value;
  assertNonNullable(parameterAreaElement);
  parameterAreaHeight.value = parameterAreaElement.clientHeight;
  resizeObserver = new ResizeObserver(() => {
    parameterAreaHeight.value = parameterAreaElement.clientHeight;
  });
  resizeObserver.observe(parameterAreaElement);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

onMountedOrActivated(() => {
  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("pointercancel", onWindowPointerCancel);
});

onUnmountedOrDeactivated(() => {
  window.removeEventListener("pointermove", onWindowPointerMove);
  window.removeEventListener("pointerup", onWindowPointerUp);
  window.removeEventListener("pointercancel", onWindowPointerCancel);
});
</script>

<style scoped lang="scss">
.phoneme-timing-editor {
  width: 100%;
  height: 100%;
  overflow: hidden;

  display: grid;
  grid-template-columns: 48px 1fr;
}

.axis-area {
  grid-column: 1;
  grid-row: 1;
  border-right: solid 1px var(--scheme-color-song-piano-keys-right-border);
}

.parameter-area {
  background: var(--scheme-color-song-grid-cell-white);
  grid-column: 2;
  grid-row: 1;
  overflow: hidden;
  position: relative;

  display: grid;
  grid-template-rows: 1fr;
}

.parameter-grid,
.note-timings,
.phoneme-timings {
  grid-column: 1;
  grid-row: 1;
  min-height: 0;
}
</style>
