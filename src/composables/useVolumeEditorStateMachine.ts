import { computed, ref, watch } from "vue";
import type { CursorState } from "@/sing/viewHelper";
import type {
  PreviewVolumeEdit,
  IdleStateId,
  VolumeEditorPartialStore,
  VolumePreviewMode,
} from "@/sing/volumeEditorStateMachine/common";
import { createVolumeEditorStateMachine } from "@/sing/volumeEditorStateMachine";

export const useVolumeEditorStateMachine = (
  store: VolumeEditorPartialStore,
) => {
  const refs = {
    previewVolumeEdit: ref<PreviewVolumeEdit | undefined>(undefined),
    previewMode: ref<VolumePreviewMode>("IDLE"),
    cursorState: ref<CursorState>("UNSET"),
  };

  const computedRefs = {
    selectedTrackId: computed(() => store.getters.SELECTED_TRACK_ID),
    playheadTicks: computed(() => store.getters.PLAYHEAD_POSITION),
    tempos: computed(() => store.state.tempos),
    tpqn: computed(() => store.state.tpqn),
    zoomX: computed(() => store.state.sequencerZoomX),
    zoomY: computed(() => store.state.sequencerZoomY),
  };

  const idleStateId = computed<IdleStateId>(() =>
    store.state.sequencerVolumeTool === "ERASE"
      ? "eraseVolumeIdle"
      : "drawVolumeIdle",
  );

  const stateMachine = createVolumeEditorStateMachine(
    {
      ...refs,
      getSelectedTrackId: () => computedRefs.selectedTrackId.value,
      playheadTicks: () => computedRefs.playheadTicks.value,
      tempos: () => computedRefs.tempos.value,
      tpqn: () => computedRefs.tpqn.value,
      zoomX: () => computedRefs.zoomX.value,
      zoomY: () => computedRefs.zoomY.value,
      setVolumeEditData: async (payload) => {
        await store.actions.COMMAND_SET_VOLUME_EDIT_DATA(payload);
      },
      eraseVolumeEditData: async (payload) => {
        await store.actions.COMMAND_ERASE_VOLUME_EDIT_DATA(payload);
      },
    },
    idleStateId.value,
  );

  watch(idleStateId, (value) => {
    if (stateMachine.currentStateId !== value) {
      stateMachine.transitionTo(value, undefined);
    }
  });

  return {
    stateMachineProcess: (input: Parameters<typeof stateMachine.process>[0]) =>
      stateMachine.process(input),
    previewVolumeEdit: computed(() => refs.previewVolumeEdit.value),
    previewMode: computed(() => refs.previewMode.value),
    cursorState: computed(() => refs.cursorState.value),
  };
};
