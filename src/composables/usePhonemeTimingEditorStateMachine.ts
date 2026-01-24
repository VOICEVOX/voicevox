import { computed, ComputedRef, ref } from "vue";
import type { CursorState, ViewportInfo } from "@/sing/viewHelper";
import type {
  PhonemeTimingPreviewEdit,
  PhonemeTimingEditorPartialStore,
  PhonemeTimingEditorPreviewMode,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorComputedRefs,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import type { TrackId } from "@/type/preload";
import type { PhonemeTimingEditData, Tempo } from "@/domain/project/type";
import { createPhonemeTimingEditorStateMachine } from "@/sing/phonemeTimingEditorStateMachine";

export const usePhonemeTimingEditorStateMachine = (
  store: PhonemeTimingEditorPartialStore,
  viewportInfo: ComputedRef<ViewportInfo>,
) => {
  const refs = {
    previewPhonemeTimingEdit: ref<PhonemeTimingPreviewEdit | undefined>(
      undefined,
    ),
    previewMode: ref<PhonemeTimingEditorPreviewMode>("IDLE"),
    cursorState: ref<CursorState>("UNSET"),
  };

  const computedRefs: PhonemeTimingEditorComputedRefs = {
    selectedTrackId: computed<TrackId>(() => store.getters.SELECTED_TRACK_ID),
    tempos: computed<Tempo[]>(() => store.state.tempos),
    tpqn: computed<number>(() => store.state.tpqn),
    viewportInfo,
    phonemeTimingEditData: computed<PhonemeTimingEditData>(
      () => store.getters.SELECTED_TRACK.phonemeTimingEditData,
    ),
    editorFrameRate: computed<number>(() => store.state.editorFrameRate),
  };

  const stateMachine = createPhonemeTimingEditorStateMachine(
    {
      ...refs,
      ...computedRefs,
      store,
    },
    "phonemeTimingEditToolIdle",
  );

  return {
    stateMachineProcess: (input: PhonemeTimingEditorInput) => {
      stateMachine.process(input);
    },
    phonemeTimingPreviewEdit: computed(
      () => refs.previewPhonemeTimingEdit.value,
    ),
    previewMode: computed(() => refs.previewMode.value),
    cursorState: computed(() => refs.cursorState.value),
  };
};
