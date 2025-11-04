import { computed, ref, watch } from "vue";
import type { CursorState } from "@/sing/viewHelper";
import type {
  ParameterPanelVolumePreviewEdit,
  ParameterPanelVolumeIdleStateId,
  ParameterPanelVolumePartialStore,
  ParameterPanelVolumePreviewMode,
  ParameterPanelVolumeInput,
  ParameterPanelVolumeComputedRefs,
} from "@/sing/parameterPanelStateMachine/common";
import type { TrackId } from "@/type/preload";
import type { Tempo } from "@/domain/project/type";
import { createParameterPanelVolumeStateMachine } from "@/sing/parameterPanelStateMachine";

export const useParameterPanelStateMachine = (
  store: ParameterPanelVolumePartialStore,
) => {
  const refs = {
    previewVolumeEdit: ref<ParameterPanelVolumePreviewEdit | undefined>(
      undefined,
    ),
    previewMode: ref<ParameterPanelVolumePreviewMode>("IDLE"),
    cursorState: ref<CursorState>("UNSET"),
  };

  const computedRefs: ParameterPanelVolumeComputedRefs = {
    selectedTrackId: computed<TrackId>(() => store.getters.SELECTED_TRACK_ID),
    playheadTicks: computed<number>(() => store.getters.PLAYHEAD_POSITION),
    tempos: computed<Tempo[]>(() => store.state.tempos),
    tpqn: computed<number>(() => store.state.tpqn),
    zoomX: computed<number>(() => store.state.sequencerZoomX),
    zoomY: computed<number>(() => store.state.sequencerZoomY),
  };

  // NOTE: parameterPanelEditTargetは今のところVOLUMEのみ。
  // 音素編集などを追加するときはここを拡張する。
  const idleStateId = computed<ParameterPanelVolumeIdleStateId>(() =>
    store.state.sequencerVolumeTool === "ERASE"
      ? "eraseVolumeIdle"
      : "drawVolumeIdle",
  );

  const isVolumeEditTargetActive = computed(
    () => store.state.parameterPanelEditTarget === "VOLUME",
  );

  const stateMachine = createParameterPanelVolumeStateMachine(
    {
      ...refs,
      ...computedRefs,
      store,
    },
    idleStateId.value,
  );

  watch([idleStateId, isVolumeEditTargetActive], ([value, isVolumeActive]) => {
    if (!isVolumeActive) {
      return;
    }
    if (stateMachine.currentStateId !== value) {
      stateMachine.transitionTo(value, undefined);
    }
  });

  return {
    volumeStateMachineProcess: (input: ParameterPanelVolumeInput) => {
      if (!isVolumeEditTargetActive.value) {
        return;
      }
      stateMachine.process(input);
    },
    volumePreviewEdit: computed(() => refs.previewVolumeEdit.value),
    volumePreviewMode: computed(() => refs.previewMode.value),
    volumeCursorState: computed(() => refs.cursorState.value),
  };
};
