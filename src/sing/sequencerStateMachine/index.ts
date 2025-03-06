import {
  Context,
  IdleStateId,
  Input,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common.ts";
import { StateMachine } from "@/sing/stateMachine.ts";

import { SelectNotesToolIdleState } from "@/sing/sequencerStateMachine/states/selectNotesToolIdleState.ts";
import { EditNotesToolIdleState } from "@/sing/sequencerStateMachine/states/editNotesToolIdleState.ts";
import { DrawPitchToolIdleState } from "@/sing/sequencerStateMachine/states/drawPitchToolIdleState.ts";
import { ErasePitchToolIdleState } from "@/sing/sequencerStateMachine/states/erasePitchToolIdleState.ts";
import { AddNoteState } from "@/sing/sequencerStateMachine/states/addNoteState.ts";
import { MoveNoteState } from "@/sing/sequencerStateMachine/states/moveNoteState.ts";
import { ResizeNoteLeftState } from "@/sing/sequencerStateMachine/states/resizeNoteLeftState.ts";
import { ResizeNoteRightState } from "@/sing/sequencerStateMachine/states/resizeNoteRightState.ts";
import { SelectNotesWithRectState } from "@/sing/sequencerStateMachine/states/selectNotesWithRectState.ts";
import { EditLyricState } from "@/sing/sequencerStateMachine/states/editLyricState.ts";
import { DrawPitchState } from "@/sing/sequencerStateMachine/states/drawPitchState.ts";
import { ErasePitchState } from "@/sing/sequencerStateMachine/states/erasePitchState.ts";

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
