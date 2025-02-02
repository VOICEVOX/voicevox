import { computed, ref } from "vue";
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
  const computedRefs: ComputedRefs = {
    snapTicks: computed(() =>
      getNoteDuration(store.state.sequencerSnapType, store.state.tpqn),
    ),
    editTarget: computed(() => store.state.sequencerEditTarget),
    selectedTrackId: computed(() => store.getters.SELECTED_TRACK_ID),
    notesInSelectedTrack: computed(() => store.getters.SELECTED_TRACK.notes),
    selectedNoteIds: computed(() => store.getters.SELECTED_NOTE_IDS),
    editorFrameRate: computed(() => store.state.editorFrameRate),
  };
  const refs: Refs = {
    nowPreviewing: ref(false),
    previewNotes: ref([]),
    previewRectForRectSelect: ref(undefined),
    previewPitchEdit: ref(undefined),
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
    nowPreviewing: computed(() => refs.nowPreviewing.value),
    previewNotes: computed(() => refs.previewNotes.value),
    previewRectForRectSelect: computed(
      () => refs.previewRectForRectSelect.value,
    ),
    guideLineTicks: computed(() => refs.guideLineTicks.value),
  };
};
