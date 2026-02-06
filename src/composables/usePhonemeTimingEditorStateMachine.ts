import { computed, ComputedRef, ref, watch } from "vue";
import type { CursorState, ViewportInfo } from "@/sing/viewHelper";
import type {
  PhonemeTimingPreview,
  PhonemeTimingEditorPartialStore,
  PhonemeTimingEditorPreviewMode,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorComputedRefs,
  PhonemeTimingEditorIdleStateId,
  PhonemeTimingInfo,
  PhraseInfo,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import type { PhraseKey } from "@/store/type";
import type { TrackId } from "@/type/preload";
import type { PhonemeTimingEditData, Tempo } from "@/domain/project/type";
import { createPhonemeTimingEditorStateMachine } from "@/sing/phonemeTimingEditorStateMachine";

export const usePhonemeTimingEditorStateMachine = (
  store: PhonemeTimingEditorPartialStore,
  viewportInfo: ComputedRef<ViewportInfo>,
  phonemeTimingInfos: ComputedRef<PhonemeTimingInfo[]>,
  phraseInfos: ComputedRef<Map<PhraseKey, PhraseInfo>>,
) => {
  const refs = {
    previewPhonemeTiming: ref<PhonemeTimingPreview | undefined>(undefined),
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

  const idleStateId = computed<PhonemeTimingEditorIdleStateId>(() =>
    store.state.sequencerPhonemeTimingTool === "ERASE"
      ? "erasePhonemeTimingToolIdle"
      : "movePhonemeTimingToolIdle",
  );

  const stateMachine = createPhonemeTimingEditorStateMachine(
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
    stateMachineProcess: (input: PhonemeTimingEditorInput) => {
      stateMachine.process(input);
    },
    previewPhonemeTiming: computed(() => refs.previewPhonemeTiming.value),
    previewMode: computed(() => refs.previewMode.value),
    cursorState: computed(() => refs.cursorState.value),
  };
};
