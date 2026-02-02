<template>
  <div class="phoneme-timing-editor">
    <div class="axis-area"></div>
    <div
      v-if="editTarget === 'PHONEME_TIMING'"
      ref="parameterArea"
      class="parameter-area"
      @pointerdown="onPointerDown"
    >
      <SequencerParameterGrid
        class="parameter-grid"
        :offsetX="props.viewportInfo.offsetX"
      />
      <SequencerWaveform
        class="waveform"
        :offsetX="props.viewportInfo.offsetX"
      />
      <SequencerNoteTimings
        class="note-timings"
        :offsetX="props.viewportInfo.offsetX"
        :offsetY="props.viewportInfo.offsetY"
      />
      <SequencerPhonemeTimings
        class="phoneme-timings"
        :viewportInfo
        :previewPhonemeTimingEdit
        :phonemeTimingInfos
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
import { assertNonNullable } from "@/type/utility";
import {
  computePhonemeTimingInfos,
  getPhraseInfosForTrack,
} from "@/sing/phonemeTimingEditorStateMachine/common";

const store = useStore();
const editTarget = computed(() => store.state.parameterPanelEditTarget);
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

const { stateMachineProcess, cursorState, previewPhonemeTimingEdit } =
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

onMountedOrActivated(() => {
  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);
});

onUnmountedOrDeactivated(() => {
  window.removeEventListener("pointermove", onWindowPointerMove);
  window.removeEventListener("pointerup", onWindowPointerUp);
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
  border-right: solid 1px var(--scheme-color-sing-piano-keys-right-border);
}

.parameter-area {
  grid-column: 2;
  grid-row: 1;
  overflow: hidden;

  display: grid;
  grid-template-rows: 12px 26px 28px 1fr;
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
