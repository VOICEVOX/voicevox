import { StateMachine } from "../stateMachine";
import type {
  Context,
  IdleStateId,
  Input,
  SequencerStateDefinitions,
} from "./common";

import { SelectNotesToolIdleState } from "./states/selectNotesToolIdleState";
import { EditNotesToolIdleState } from "./states/editNotesToolIdleState";
import { DrawPitchToolIdleState } from "./states/drawPitchToolIdleState";
import { ErasePitchToolIdleState } from "./states/erasePitchToolIdleState";
import { AddNoteState } from "./states/addNoteState";
import { MoveNoteState } from "./states/moveNoteState";
import { ResizeNoteLeftState } from "./states/resizeNoteLeftState";
import { ResizeNoteRightState } from "./states/resizeNoteRightState";
import { SelectNotesWithRectState } from "./states/selectNotesWithRectState";
import { EditLyricState } from "./states/editLyricState";
import { DrawPitchState } from "./states/drawPitchState";
import { ErasePitchState } from "./states/erasePitchState";

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
