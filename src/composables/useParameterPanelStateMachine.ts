import { computed, ref, watch } from "vue";
import type { CursorState } from "@/sing/viewHelper";
import type {
  ParameterPanelVolumePreviewEdit,
  ParameterPanelIdleStateId,
  ParameterPanelPartialStore,
  ParameterPanelPreviewMode,
  ParameterPanelInput,
  ParameterPanelComputedRefs,
} from "@/sing/parameterPanelStateMachine/common";
import type { TrackId } from "@/type/preload";
import type { Tempo } from "@/domain/project/type";
import { createParameterPanelStateMachine } from "@/sing/parameterPanelStateMachine";

export const useParameterPanelStateMachine = (
  store: ParameterPanelPartialStore,
) => {
  const refs = {
    previewVolumeEdit: ref<ParameterPanelVolumePreviewEdit | undefined>(
      undefined,
    ),
    previewMode: ref<ParameterPanelPreviewMode>("IDLE"),
    cursorState: ref<CursorState>("UNSET"),
  };

  const computedRefs: ParameterPanelComputedRefs = {
    selectedTrackId: computed<TrackId>(() => store.getters.SELECTED_TRACK_ID),
    playheadTicks: computed<number>(() => store.getters.PLAYHEAD_POSITION),
    tempos: computed<Tempo[]>(() => store.state.tempos),
    tpqn: computed<number>(() => store.state.tpqn),
    zoomX: computed<number>(() => store.state.sequencerZoomX),
    zoomY: computed<number>(() => store.state.sequencerZoomY),
  };

  // NOTE: parameterPanelEditTargetは今のところVOLUMEのみ。
  // 音素編集などを追加するときはここを拡張する。
  const idleStateId = computed<ParameterPanelIdleStateId>(() =>
    store.state.sequencerVolumeTool === "ERASE"
      ? "eraseVolumeIdle"
      : "drawVolumeIdle",
  );

  // TODO:isVolumeEditTargetActiveはパラメータパネル内で編集対象がボリューム編集かどうかを判別するフラグ
  // 最適なUIに応じて必要かどうかが異なるため、UIが固まった時点で変更・削除する可能性あり
  const isVolumeEditTargetActive = computed(
    () => store.state.parameterPanelEditTarget === "VOLUME",
  );

  const stateMachine = createParameterPanelStateMachine(
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
    volumeStateMachineProcess: (input: ParameterPanelInput) => {
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
