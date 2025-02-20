import {
  Context,
  IdleStateId,
  Input,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import { StateMachine } from "@/sing/stateMachine";

import { SelectNotesToolIdleState } from "@/sing/sequencerStateMachine/states/selectNotesToolIdleState";
import { EditNotesToolIdleState } from "@/sing/sequencerStateMachine/states/editNotesToolIdleState";
import { DrawPitchToolIdleState } from "@/sing/sequencerStateMachine/states/drawPitchToolIdleState";
import { ErasePitchToolIdleState } from "@/sing/sequencerStateMachine/states/erasePitchToolIdleState";
import { AddNoteState } from "@/sing/sequencerStateMachine/states/addNoteState";
import { MoveNoteState } from "@/sing/sequencerStateMachine/states/moveNoteState";
import { ResizeNoteLeftState } from "@/sing/sequencerStateMachine/states/resizeNoteLeftState";
import { ResizeNoteRightState } from "@/sing/sequencerStateMachine/states/resizeNoteRightState";
import { SelectNotesWithRectState } from "@/sing/sequencerStateMachine/states/selectNotesWithRectState";
import { EditLyricState } from "@/sing/sequencerStateMachine/states/editLyricState";
import { DrawPitchState } from "@/sing/sequencerStateMachine/states/drawPitchState";
import { ErasePitchState } from "@/sing/sequencerStateMachine/states/erasePitchState";

export const createSequencerStateMachine = (
  context: Context,
  initialStateId: IdleStateId,
) => {
  return new StateMachine<SequencerStateDefinitions, Input, Context>(
    {
      selectNotesToolIdle: () => new SelectNotesToolIdleState(),
      editNotesToolIdle: () => new EditNotesToolIdleState(),
      drawPitchToolIdle: () => new DrawPitchToolIdleState(),
      erasePitchToolIdle: () => new ErasePitchToolIdleState(),
      addNote: (args) => new AddNoteState(args),
      moveNote: (args) => new MoveNoteState(args),
      resizeNoteLeft: (args) => new ResizeNoteLeftState(args),
      resizeNoteRight: (args) => new ResizeNoteRightState(args),
      selectNotesWithRect: (args) => new SelectNotesWithRectState(args),
      editNoteLyric: (args) => new EditLyricState(args),
      drawPitch: (args) => new DrawPitchState(args),
      erasePitch: (args) => new ErasePitchState(args),
    },
    context,
    initialStateId,
  );
};
