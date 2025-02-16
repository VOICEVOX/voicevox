import { computed, ref } from "vue";
import { useCommandOrControlKey, useShiftKey } from "./useModifierKey";
import {
  ComputedRefs,
  IdleStateId,
  PartialStore,
  Refs,
} from "@/sing/sequencerStateMachine/common";
import { getNoteDuration } from "@/sing/domain";
import { createSequencerStateMachine } from "@/sing/sequencerStateMachine";

export const useSequencerStateMachine = (
  store: PartialStore,
  initialStateId: IdleStateId,
) => {
  const isShiftKeyDown = useShiftKey();
  const isCommandOrCtrlKeyDown = useCommandOrControlKey();

  const computedRefs: ComputedRefs = {
    snapTicks: computed(() =>
      getNoteDuration(store.state.sequencerSnapType, store.state.tpqn),
    ),
    editTarget: computed(() => store.state.sequencerEditTarget),
    selectedTrackId: computed(() => store.getters.SELECTED_TRACK_ID),
    notesInSelectedTrack: computed(() => store.getters.SELECTED_TRACK.notes),
    selectedNoteIds: computed(() => store.getters.SELECTED_NOTE_IDS),
    editorFrameRate: computed(() => store.state.editorFrameRate),
    isShiftKeyDown: computed(() => isShiftKeyDown.value),
    isCommandOrCtrlKeyDown: computed(() => isCommandOrCtrlKeyDown.value),
  };

  const refs: Refs = {
    previewMode: ref("IDLE"),
    previewNotes: ref([]),
    previewRectForRectSelect: ref(undefined),
    previewPitchEdit: ref(undefined),
    cursorState: ref("UNSET"),
    guideLineTicks: ref(0),
  };

  const stateMachine = createSequencerStateMachine(
    {
      ...computedRefs,
      ...refs,
      store,
    },
    initialStateId,
  );

  return {
    stateMachine,
    previewMode: computed(() => refs.previewMode.value),
    previewNotes: computed(() => refs.previewNotes.value),
    previewRectForRectSelect: computed(
      () => refs.previewRectForRectSelect.value,
    ),
    previewPitchEdit: computed(() => refs.previewPitchEdit.value),
    cursorState: computed(() => refs.cursorState.value),
    guideLineTicks: computed(() => refs.guideLineTicks.value),
  };
};
