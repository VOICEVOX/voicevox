import { computed, ref, shallowRef, watch } from "vue";
import type { CursorState } from "@/sing/viewHelper";
import type {
  VolumePreviewEdit,
  VolumeEditorIdleStateId,
  VolumeEditorPartialStore,
  VolumeEditorPreviewMode,
  VolumeEditorInput,
  VolumeEditorComputedRefs,
  VolumeEditorTooltipData,
} from "@/sing/volumeEditorStateMachine/common";
import type { TrackId } from "@/type/preload";
import { createVolumeEditorStateMachine } from "@/sing/volumeEditorStateMachine";
import type { VolumeEditableFrameRange } from "@/sing/volumeEditRanges";

export const useVolumeEditorStateMachine = (
  store: VolumeEditorPartialStore,
  options: {
    getEditableFrameRanges: () => readonly VolumeEditableFrameRange[];
  },
) => {
  const refs = {
    // NOTE: data配列が大きくなるため、shallowRefで深いリアクティブ化を避ける
    // 値の変更通知は.valueへの再代入で行う
    previewVolumeEdit: shallowRef<VolumePreviewEdit | undefined>(undefined),
    previewMode: ref<VolumeEditorPreviewMode>("IDLE"),
    cursorState: ref<CursorState>("UNSET"),
    tooltipData: ref<VolumeEditorTooltipData>(),
    highlightedFrame: ref<number>(),
  };

  const computedRefs: VolumeEditorComputedRefs = {
    selectedTrackId: computed<TrackId>(() => store.getters.SELECTED_TRACK_ID),
  };

  const idleStateId = computed<VolumeEditorIdleStateId>(() =>
    store.state.sequencerVolumeTool === "ERASE"
      ? "eraseVolumeIdle"
      : "drawVolumeIdle",
  );

  const stateMachine = createVolumeEditorStateMachine(
    {
      ...refs,
      ...computedRefs,
      getEditableFrameRanges: options.getEditableFrameRanges,
      store,
    },
    idleStateId.value,
  );

  watch(idleStateId, (value) => {
    if (stateMachine.currentStateId !== value) {
      stateMachine.transitionTo(value, undefined);
    }
  });

  return {
    stateMachineProcess: (input: VolumeEditorInput) => {
      stateMachine.process(input);
    },
    volumePreviewEdit: computed(() => refs.previewVolumeEdit.value),
    previewMode: computed(() => refs.previewMode.value),
    cursorState: computed(() => refs.cursorState.value),
    tooltipData: computed(() => refs.tooltipData.value),
    highlightedFrame: computed(() => refs.highlightedFrame.value),
  };
};
