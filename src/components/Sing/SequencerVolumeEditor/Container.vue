<template>
  <Presentation
    :viewportInfo="props.viewportInfo"
    :effectiveFramewise
    :previewEraseRanges
    :tempos
    :tpqn
    :editorFrameRate
    :previewMode
    :cursorState
    :tooltipData
    :highlightedEditableRange
    :tool
    :isDark
    :uiLocked
    :volumeEditMode
    @pointerEvent="processPointerEvent"
    @update:tool="setTool"
    @panTimeline="(deltaX) => emit('panTimeline', deltaX)"
    @zoomTimeline="(anchorX, deltaY) => emit('zoomTimeline', anchorX, deltaY)"
  >
    <template #grid>
      <SequencerParameterGrid :viewportInfo="props.viewportInfo" />
    </template>
    <template #waveform>
      <SequencerWaveform
        :viewportInfo="props.viewportInfo"
        displayMode="BOTTOM_ALIGNED"
        aria-hidden="true"
      />
    </template>
  </Presentation>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, toRaw, watch } from "vue";
import Presentation from "./Presentation.vue";
import type { VolumeEditorPointerEvent } from "./useVolumeEditorPointerInput";
import SequencerParameterGrid from "@/components/Sing/SequencerParameterGrid.vue";
import SequencerWaveform from "@/components/Sing/SequencerWaveform.vue";
import { useStore } from "@/store";
import type { VolumeEditTool } from "@/store/type";
import { useVolumeEditorStateMachine } from "@/composables/useVolumeEditorStateMachine";
import { relativeVolumeEditMode } from "@/sing/volumeEditMode";
import { buildVolumeEditDisplayData } from "@/sing/volumeEditDisplay";
import {
  deriveVolumeEditableFrameRanges,
  findVolumeEditableFrameRange,
  type VolumeEditableFrameRange,
} from "@/sing/volumeEditRanges";
import type { ViewportInfo } from "@/sing/viewHelper";

defineOptions({
  name: "SequencerVolumeEditor",
});

const props = defineProps<{
  viewportInfo: ViewportInfo;
}>();

const emit = defineEmits<{
  "update:needsAutoScroll": [value: boolean];
  panTimeline: [deltaX: number];
  zoomTimeline: [anchorX: number, deltaY: number];
}>();

const store = useStore();
const volumeEditMode = relativeVolumeEditMode;

const tool = computed<VolumeEditTool>(() => store.state.sequencerVolumeTool);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const selectedTrack = computed(() => store.getters.SELECTED_TRACK);
const tempos = computed(() => store.state.tempos);
const tpqn = computed(() => store.state.tpqn);
const editorFrameRate = computed(() => store.state.editorFrameRate);
const isDark = computed(() => store.state.currentTheme === "Dark");
const uiLocked = computed(() => store.getters.UI_LOCKED);

const editableFrameRanges = computed<readonly VolumeEditableFrameRange[]>(() =>
  deriveVolumeEditableFrameRanges({
    phrases: store.state.phrases.values(),
    phraseQueries: store.state.phraseQueries,
    phraseSingingVolumes: store.state.phraseSingingVolumes,
    trackId: selectedTrackId.value,
    frameRate: editorFrameRate.value,
  }),
);

const {
  volumePreviewEdit,
  stateMachineProcess,
  previewMode,
  cursorState,
  tooltipData,
  highlightedFrame,
} = useVolumeEditorStateMachine(store, {
  getEditableFrameRanges: () => editableFrameRanges.value,
});

// レンダリングが進むと編集可能区間は増減し、区間オブジェクトを保持すると
// 消えた区間や境界の古い区間をハイライトし続けてしまう。
// そのためステートマシンはフレームだけを持ち、ここでその時点の区間に解決する
const highlightedEditableRange = computed(() => {
  const frame = highlightedFrame.value;
  if (frame == undefined) {
    return undefined;
  }
  return findVolumeEditableFrameRange(frame, editableFrameRanges.value);
});

const volumeEditDisplayData = computed(() =>
  buildVolumeEditDisplayData({
    // Store側では、volumeEditDataは要素を書き換えず配列ごと差し替えるようになっているので、要素単位の変更を追う必要がない。
    // 要素まで追うと依存がフレーム数に比例して増えるため、toRawで要素を追跡の対象から外す。
    volumeEditData: toRaw(selectedTrack.value.volumeEditData),
    previewEdit: volumePreviewEdit.value,
    editableRanges: editableFrameRanges.value,
  }),
);
const effectiveFramewise = computed(
  () => volumeEditDisplayData.value.effectiveFramewise,
);
const previewEraseRanges = computed(
  () => volumeEditDisplayData.value.previewEraseRanges,
);

watch(previewMode, (mode) => {
  emit("update:needsAutoScroll", mode !== "IDLE");
});

onBeforeUnmount(() => {
  if (previewMode.value !== "IDLE") {
    emit("update:needsAutoScroll", false);
  }
});

const setTool = (value: VolumeEditTool) => {
  if (value === tool.value) {
    return;
  }
  void store.actions.SET_SEQUENCER_VOLUME_TOOL({
    sequencerVolumeTool: value,
  });
};

const processPointerEvent = (event: VolumeEditorPointerEvent) => {
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: event.targetArea,
    pointerEvent: event.pointerEvent,
    pointerInfo: event.pointerInfo,
  });
};
</script>
