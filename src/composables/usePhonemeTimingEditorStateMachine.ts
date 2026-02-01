import { computed, ComputedRef, ref } from "vue";
import type { CursorState, ViewportInfo } from "@/sing/viewHelper";
import type {
  PhonemeTimingPreviewEdit,
  PhonemeTimingEditorPartialStore,
  PhonemeTimingEditorPreviewMode,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorComputedRefs,
  PhraseInfo,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import type { PhraseKey } from "@/store/type";
import type { TrackId } from "@/type/preload";
import type { PhonemeTimingEditData, Tempo } from "@/domain/project/type";
import { createPhonemeTimingEditorStateMachine } from "@/sing/phonemeTimingEditorStateMachine";
import type { PhonemeTimingInfo } from "@/sing/phonemeTimingEditorStateMachine/common";

export const usePhonemeTimingEditorStateMachine = (
  store: PhonemeTimingEditorPartialStore,
  viewportInfo: ComputedRef<ViewportInfo>,
  phonemeTimingInfos: ComputedRef<PhonemeTimingInfo[]>,
  phraseInfos: ComputedRef<Map<PhraseKey, PhraseInfo>>,
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
    phonemeTimingInfos,
    phraseInfos,
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
    previewPhonemeTimingEdit: computed(
      () => refs.previewPhonemeTimingEdit.value,
    ),
    previewMode: computed(() => refs.previewMode.value),
    cursorState: computed(() => refs.cursorState.value),
  };
};
