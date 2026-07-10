<template>
  <Presentation
    :viewportInfo="props.viewportInfo"
    :effectiveFramewise
    :previewEraseRanges
    :editableFrameRanges
    :tempos
    :tpqn
    :editorFrameRate
    :previewMode
    :cursorState
    :tooltipData
    :tool
    :isDark
    :uiLocked
    @pointerEvent="processPointerEvent"
    @update:tool="setTool"
    @panTimeline="(deltaX) => emit('panTimeline', deltaX)"
    @zoomTimeline="(anchorX, deltaY) => emit('zoomTimeline', anchorX, deltaY)"
  />
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  toRaw,
  watch,
} from "vue";
import Presentation from "./Presentation.vue";
import { useVolumeEditorStateMachine } from "./useStateMachine";
import type { VolumeEditorPointerEvent } from "./useInteraction";
import { useStore } from "@/store";
import type { VolumeEditTool } from "@/store/type";
import { useMounted } from "@/composables/useMounted";
import { Mutex } from "@/helpers/mutex";
import { ensureNotNullish } from "@/type/utility";
import { numMeasuresInjectionKey } from "@/components/Sing/ScoreSequencer.vue";
import { currentVolumeEditMode } from "@/sing/volumeEditMode";
import { buildVolumeEditDisplayData } from "@/sing/volumeEditDisplay";
import {
  deriveVolumeEditableFrameRanges,
  type VolumeEditFrameRange,
  type VolumeEditableFrameRange,
} from "@/sing/volumeEditRanges";
import type { ViewportInfo } from "@/sing/viewHelper";
import type { Note } from "@/domain/project/type";

defineOptions({
  name: "SequencerVolumeEditor",
});

const props = defineProps<{
  viewportInfo: ViewportInfo;
  noteMovePreview?: Note[];
}>();

const emit = defineEmits<{
  "update:needsAutoScroll": [value: boolean];
  panTimeline: [deltaX: number];
  zoomTimeline: [anchorX: number, deltaY: number];
}>();

const store = useStore();
const volumeEditMode = currentVolumeEditMode;

const editableFrameRanges = shallowRef<VolumeEditableFrameRange[]>([]);
const effectiveFramewise = shallowRef<number[]>([]);
const previewEraseRanges = shallowRef<VolumeEditFrameRange[]>([]);

const {
  volumePreviewEdit,
  stateMachineProcess,
  previewMode,
  cursorState,
  tooltipData,
} = useVolumeEditorStateMachine(store, {
  getEditableFrameRanges: () => editableFrameRanges.value,
});

const tool = computed<VolumeEditTool>(() => store.state.sequencerVolumeTool);
const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const selectedTrack = computed(() => store.getters.SELECTED_TRACK);
const tempos = computed(() => store.state.tempos);
const tpqn = computed(() => store.state.tpqn);
const editorFrameRate = computed(() => store.state.editorFrameRate);
const timeSignatures = computed(() => store.state.timeSignatures);
const isDark = computed(() => store.state.currentTheme === "Dark");
const uiLocked = computed(() => store.getters.UI_LOCKED);

const numMeasuresContext = ensureNotNullish(
  inject(numMeasuresInjectionKey),
  "numMeasuresContext is undefined.",
);
const { numMeasures } = numMeasuresContext;

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
  if (
    event.targetArea === "Editor" &&
    event.pointerEvent.type === "pointerdown" &&
    store.state.parameterPanelEditTarget !== "VOLUME"
  ) {
    void store.actions.SET_PARAMETER_PANEL_EDIT_TARGET({
      editTarget: "VOLUME",
    });
  }
  stateMachineProcess({
    type: "pointerEvent",
    targetArea: event.targetArea,
    pointerEvent: event.pointerEvent,
    pointerInfo: event.pointerInfo,
  });
};

// phrases内部の更新を検知し、表示データを更新するためのシグネチャ
const phraseSignature = computed(() =>
  [...store.state.phrases.values()].map(
    (phrase) =>
      `${phrase.trackId}:${phrase.startTime}:${phrase.notes.length}:${phrase.minNonPauseStartFrame}:${phrase.maxNonPauseEndFrame}:${phrase.singingVolumeKey}`,
  ),
);

const refreshVolumeSegmentsLock = new Mutex();

const refreshEditableFrameRanges = () => {
  editableFrameRanges.value = deriveVolumeEditableFrameRanges({
    phrases: store.state.phrases.values(),
    phraseQueries: store.state.phraseQueries,
    phraseSingingVolumes: store.state.phraseSingingVolumes,
    trackId: selectedTrackId.value,
    frameRate: editorFrameRate.value,
  });
};

const refreshVolumeEditDisplay = () => {
  const displayData = buildVolumeEditDisplayData({
    volumeEditData: selectedTrack.value.volumeEditData,
    previewEdit: volumePreviewEdit.value,
    noteMovePreview: props.noteMovePreview,
    notes: selectedTrack.value.notes,
    editableRanges: editableFrameRanges.value,
    tempos: toRaw(tempos.value),
    tpqn: tpqn.value,
    frameRate: editorFrameRate.value,
    volumeEditMode,
  });
  effectiveFramewise.value = displayData.effectiveFramewise;
  previewEraseRanges.value = displayData.previewEraseRanges;
};

const { mounted } = useMounted();

// NOTE: mountedをwatchしているので、onMountedの直後に必ず1回実行される
// NOTE: フレーズが変わると有効編集範囲が変わるため、表示データも再計算する
watch(
  [
    mounted,
    phraseSignature,
    selectedTrackId,
    tempos,
    timeSignatures,
    tpqn,
    numMeasures,
    editorFrameRate,
  ],
  async ([isMounted]) => {
    await using _lock = await refreshVolumeSegmentsLock.acquire();
    if (isMounted) {
      refreshEditableFrameRanges();
      refreshVolumeEditDisplay();
    }
  },
);

watch(
  [
    selectedTrackId,
    () => selectedTrack.value.volumeEditData,
    volumePreviewEdit,
    () => props.noteMovePreview,
  ],
  async () => {
    await using _lock = await refreshVolumeSegmentsLock.acquire();
    refreshVolumeEditDisplay();
  },
);

onMounted(() => {
  if (store.state.parameterPanelEditTarget !== "VOLUME") {
    void store.actions.SET_PARAMETER_PANEL_EDIT_TARGET({
      editTarget: "VOLUME",
    });
  }
});
</script>
