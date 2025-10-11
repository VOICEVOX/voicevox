import { computed, ref, watch } from "vue";
import { useCommandOrControlKey, useShiftKey } from "./useModifierKey";
import {
  ComputedRefs,
  IdleStateId,
  Input,
  PartialStore,
  Refs,
} from "@/sing/sequencerStateMachine/common";
import { getNoteDuration } from "@/sing/domain";
import { createSequencerStateMachine } from "@/sing/sequencerStateMachine";
import { ExhaustiveError } from "@/type/utility";

export const useSequencerStateMachine = (store: PartialStore) => {
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
    editingLyricNoteId: computed(() => store.state.editingLyricNoteId),
    editorFrameRate: computed(() => store.state.editorFrameRate),
    isShiftKeyDown: computed(() => isShiftKeyDown.value),
    isCommandOrCtrlKeyDown: computed(() => isCommandOrCtrlKeyDown.value),
  };

  const refs: Refs = {
    previewMode: ref("IDLE"),
    previewNotes: ref([]),
    previewLyrics: ref(new Map()),
    previewRectForRectSelect: ref(undefined),
    previewPitchEdit: ref(undefined),
    cursorState: ref("UNSET"),
    guideLineTicks: ref(0),
    enableAutoScrollOnEdge: ref(false),
  };

  const idleStateId = computed((): IdleStateId => {
    if (store.state.sequencerEditTarget === "NOTE") {
      if (store.state.sequencerNoteTool === "SELECT_FIRST") {
        return "selectNotesToolIdle";
      } else if (store.state.sequencerNoteTool === "EDIT_FIRST") {
        return "editNotesToolIdle";
      } else {
        throw new ExhaustiveError(store.state.sequencerNoteTool);
      }
    } else if (store.state.sequencerEditTarget === "PITCH") {
      if (store.state.sequencerPitchTool === "DRAW") {
        return "drawPitchToolIdle";
      } else if (store.state.sequencerPitchTool === "ERASE") {
        return "erasePitchToolIdle";
      } else {
        throw new ExhaustiveError(store.state.sequencerPitchTool);
      }
    } else {
      throw new ExhaustiveError(store.state.sequencerEditTarget);
    }
  });

  const stateMachine = createSequencerStateMachine(
    {
      ...computedRefs,
      ...refs,
      store,
    },
    idleStateId.value,
  );

  watch(idleStateId, (value) => {
    if (stateMachine.currentStateId !== value) {
      // TODO: transitionToを使わない形で実装し直す
      stateMachine.transitionTo(value, undefined);
    }
  });

  return {
    stateMachineProcess: (input: Input) => stateMachine.process(input),
    previewMode: computed(() => refs.previewMode.value),
    previewNotes: computed(() => refs.previewNotes.value),
    previewLyrics: computed(() => refs.previewLyrics.value),
    previewRectForRectSelect: computed(
      () => refs.previewRectForRectSelect.value,
    ),
    previewPitchEdit: computed(() => refs.previewPitchEdit.value),
    cursorState: computed(() => refs.cursorState.value),
    guideLineTicks: computed(() => refs.guideLineTicks.value),
    enableAutoScrollOnEdge: computed(() => refs.enableAutoScrollOnEdge.value),
  };
};
