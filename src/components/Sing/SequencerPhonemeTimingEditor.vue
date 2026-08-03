<template>
  <div class="phoneme-timing-editor">
    <div class="axis-area"></div>
    <div
      ref="parameterArea"
      class="parameter-area"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
    >
      <SequencerParameterGrid class="parameter-grid" :viewportInfo />
      <SequencerWaveform class="waveform" :viewportInfo />
      <SequencerNoteTimings class="note-timings" :viewportInfo />
      <SequencerPhonemeTimings
        class="phoneme-timings"
        :viewportInfo
        :previewPhonemeTiming
        :phonemeTimingInfos
        :phonemeTextY
      />
      <SequencerPhonemeTimingToolPalette
        :sequencerPhonemeTimingTool
        @update:sequencerPhonemeTimingTool="setSequencerPhonemeTimingTool"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { ViewportInfo } from "@/sing/viewHelper";
import { useStore } from "@/store";
import { usePhonemeTimingEditorStateMachine } from "@/composables/usePhonemeTimingEditorStateMachine";
import {
  onMountedOrActivated,
  onUnmountedOrDeactivated,
} from "@/composables/onMountOrActivate";
import SequencerParameterGrid from "@/components/Sing/SequencerParameterGrid.vue";
import SequencerWaveform from "@/components/Sing/SequencerWaveform.vue";
import SequencerPhonemeTimings from "@/components/Sing/SequencerPhonemeTimings.vue";
import SequencerNoteTimings from "@/components/Sing/SequencerNoteTimings.vue";
import SequencerPhonemeTimingToolPalette from "@/components/Sing/SequencerPhonemeTimingToolPalette.vue";
import { assertNonNullable } from "@/type/utility";
import {
  computePhonemeTimingInfos,
  getPhraseInfosForTrack,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import type { PhonemeTimingEditTool } from "@/store/type";

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

const { stateMachineProcess, cursorState, previewPhonemeTiming } =
  usePhonemeTimingEditorStateMachine(
    store,
    viewportInfo,
    phonemeTimingInfos,
    phraseInfos,
  );

const parameterArea = ref<HTMLElement | null>(null);

const cursorStyle = computed(() => {
  switch (cursorState.value) {
    case "EW_RESIZE":
      return "ew-resize";
    case "ERASE":
      // NOTE: 消しゴム用のカーソル・画像がないため、一旦defaultにしている
      // TODO: 消しゴム用のカーソル・画像を用意して差し替える
      return "default";
    default:
      return "default";
  }
});

const getXInBorderBox = (clientX: number, element: HTMLElement) => {
  return clientX - element.getBoundingClientRect().left;
};

const getLocalPositionX = (event: PointerEvent): number => {
  const parameterAreaElement = parameterArea.value;
  assertNonNullable(parameterAreaElement);
  return getXInBorderBox(event.clientX, parameterAreaElement);
};

const onPointerDown = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "PhonemeTimingArea",
    pointerEvent: event,
    positionX: getLocalPositionX(event),
  });
};

const onPointerMove = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "PhonemeTimingArea",
    pointerEvent: event,
    positionX: getLocalPositionX(event),
  });
};

const onWindowPointerMove = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "Window",
    pointerEvent: event,
    positionX: getLocalPositionX(event),
  });
};

const onWindowPointerUp = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "Window",
    pointerEvent: event,
    positionX: getLocalPositionX(event),
  });
};

const onWindowPointerCancel = (event: PointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: "Window",
    pointerEvent: event,
    positionX: getLocalPositionX(event),
  });
};

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

// parameter-areaの各行の高さ
const TOP_ROW_HEIGHT = 12;
const NOTES_ROW_HEIGHT = 26;
const PHONEME_TEXTS_ROW_HEIGHT = 28;

// 音素文字行内での音素文字の上端オフセット
const PHONEME_TEXT_TOP_OFFSET_IN_ROW = 12;

// SequencerPhonemeTimingsの音素文字のY座標
const phonemeTextY =
  TOP_ROW_HEIGHT + NOTES_ROW_HEIGHT + PHONEME_TEXT_TOP_OFFSET_IN_ROW;
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
  border-right: solid 1px var(--scheme-color-sing-piano-keys-right-border);
}

.parameter-area {
  grid-column: 2;
  grid-row: 1;
  overflow: hidden;
  position: relative;

  display: grid;
  grid-template-rows:
    v-bind("`${TOP_ROW_HEIGHT}px`")
    v-bind("`${NOTES_ROW_HEIGHT}px`")
    v-bind("`${PHONEME_TEXTS_ROW_HEIGHT}px`")
    1fr;
  cursor: v-bind(cursorStyle);
}

.parameter-grid {
  grid-column: 1;
  grid-row: 1 / 5;
}

.waveform {
  grid-column: 1;
  grid-row: 4 / 5;
}

.note-timings {
  grid-column: 1;
  grid-row: 2 / 3;
}

.phoneme-timings {
  grid-column: 1;
  grid-row: 1 / 5;
}
</style>
