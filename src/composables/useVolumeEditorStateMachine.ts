import { computed, ref, shallowRef, watch } from "vue";
import type { CursorState } from "@/sing/viewHelper";
import type {
  VolumePreviewEdit,
  VolumeEditorIdleStateId,
  VolumeEditorPartialStore,
  VolumeEditorPreviewMode,
  VolumeEditorInput,
  VolumeEditorComputedRefs,
} from "@/sing/volumeEditorStateMachine/common";
import type { TrackId } from "@/type/preload";
import type { Tempo } from "@/domain/project/type";
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
  };

  const computedRefs: VolumeEditorComputedRefs = {
    selectedTrackId: computed<TrackId>(() => store.getters.SELECTED_TRACK_ID),
    playheadTicks: computed<number>(() => store.getters.PLAYHEAD_POSITION),
    tempos: computed<Tempo[]>(() => store.state.tempos),
    tpqn: computed<number>(() => store.state.tpqn),
    zoomX: computed<number>(() => store.state.sequencerZoomX),
    zoomY: computed<number>(() => store.state.sequencerZoomY),
    nowPlaying: computed<boolean>(() => store.state.nowPlaying),
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
  };
};
