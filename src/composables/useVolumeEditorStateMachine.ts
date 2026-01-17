import { computed, ref, watch } from "vue";
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

export const useVolumeEditorStateMachine = (store: VolumeEditorPartialStore) => {
  const refs = {
    previewVolumeEdit: ref<VolumePreviewEdit | undefined>(undefined),
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
