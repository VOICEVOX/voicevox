import { computed, ref, shallowRef, watch } from "vue";
import type { CursorState } from "@/song/viewHelper";
import type {
  VolumePreviewEdit,
  VolumeEditorIdleStateId,
  VolumeEditorPartialStore,
  VolumeEditorPreviewMode,
  VolumeEditorInput,
  VolumeEditorComputedRefs,
  VolumeEditorTooltipData,
} from "@/song/volumeEditorStateMachine/common";
import type { TrackId } from "@/type/preload";
import type { VolumeEditValue } from "@/domain/project/type";
import { createVolumeEditorStateMachine } from "@/song/volumeEditorStateMachine";
import type { VolumeEditableFrameRange } from "@/song/volumeEditRanges";

export const useVolumeEditorStateMachine = (
  store: VolumeEditorPartialStore,
  options: {
    getEditableFrameRanges: () => readonly VolumeEditableFrameRange[];
    /** 表示中のカーブの値。編集可能区間外はnull、範囲外のフレームはundefined。 */
    getEffectiveVolumeValue: (frame: number) => VolumeEditValue | undefined;
  },
) => {
  const refs = {
    // NOTE: data配列が大きくなるため、shallowRefで深いリアクティブ化を避ける
    // 値の変更通知は.valueへの再代入で行う
    previewVolumeEdit: shallowRef<VolumePreviewEdit | undefined>(undefined),
    previewMode: ref<VolumeEditorPreviewMode>("IDLE"),
    cursorState: ref<CursorState>("UNSET"),
    showDrawFeedback: ref(false),
    tooltipData: ref<VolumeEditorTooltipData>(),
    highlightedFrame: ref<number>(),
    hoverPointer: ref<{ x: number; y: number }>(),
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
    showDrawFeedback: computed(() => refs.showDrawFeedback.value),
    // ホバー中は、ステートマシンが保持するフレームと座標から、その時点のカーブの値で導く
    tooltipData: computed<VolumeEditorTooltipData | undefined>(() => {
      if (refs.tooltipData.value != undefined) {
        return refs.tooltipData.value;
      }
      const frame = refs.highlightedFrame.value;
      const pointer = refs.hoverPointer.value;
      if (frame == undefined || pointer == undefined) {
        return undefined;
      }
      const value = options.getEffectiveVolumeValue(frame);
      if (value == null) {
        return undefined;
      }
      return { db: value, pointerX: pointer.x, pointerY: pointer.y };
    }),
    highlightedFrame: computed(() => refs.highlightedFrame.value),
  };
};
