import { computed, ref } from "vue";
import {
  ComputedRefs,
  Context,
  Input,
  PartialStore,
  Refs,
  SequencerStateDefinitions,
} from "@/components/Sing/sequencerStateMachine/common";
import { getNoteDuration } from "@/sing/domain";
import { StateMachine } from "@/sing/stateMachine";

import { IdleState } from "@/components/Sing/sequencerStateMachine/states/idleState";
import { AddNoteState } from "@/components/Sing/sequencerStateMachine/states/addNoteState";
import { MoveNoteState } from "@/components/Sing/sequencerStateMachine/states/moveNoteState";
import { ResizeNoteLeftState } from "@/components/Sing/sequencerStateMachine/states/resizeNoteLeftState";
import { ResizeNoteRightState } from "@/components/Sing/sequencerStateMachine/states/resizeNoteRightState";
import { SelectNotesWithRectState } from "@/components/Sing/sequencerStateMachine/states/selectNotesWithRectState";
import { DrawPitchState } from "@/components/Sing/sequencerStateMachine/states/drawPitchState";
import { ErasePitchState } from "@/components/Sing/sequencerStateMachine/states/erasePitchState";

export const useSequencerStateMachine = (store: PartialStore) => {
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
  const stateMachine = new StateMachine<
    SequencerStateDefinitions,
    Input,
    Context
  >(
    {
      idle: () => new IdleState(),
      addNote: (args) => new AddNoteState(args),
      moveNote: (args) => new MoveNoteState(args),
      resizeNoteLeft: (args) => new ResizeNoteLeftState(args),
      resizeNoteRight: (args) => new ResizeNoteRightState(args),
      selectNotesWithRect: (args) => new SelectNotesWithRectState(args),
      drawPitch: (args) => new DrawPitchState(args),
      erasePitch: (args) => new ErasePitchState(args),
    },
    new IdleState(),
    {
      ...computedRefs,
      ...refs,
      store,
    },
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
