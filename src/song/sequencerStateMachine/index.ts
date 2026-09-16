import type {
  Context,
  IdleStateId,
  Input,
  SequencerStateDefinitions,
} from "@/song/sequencerStateMachine/common";
import { StateMachine } from "@/song/stateMachine";

import { SelectNotesToolIdleState } from "@/song/sequencerStateMachine/states/selectNotesToolIdleState";
import { EditNotesToolIdleState } from "@/song/sequencerStateMachine/states/editNotesToolIdleState";
import { DrawPitchToolIdleState } from "@/song/sequencerStateMachine/states/drawPitchToolIdleState";
import { ErasePitchToolIdleState } from "@/song/sequencerStateMachine/states/erasePitchToolIdleState";
import { AddNoteState } from "@/song/sequencerStateMachine/states/addNoteState";
import { MoveNoteState } from "@/song/sequencerStateMachine/states/moveNoteState";
import { ResizeNoteLeftState } from "@/song/sequencerStateMachine/states/resizeNoteLeftState";
import { ResizeNoteRightState } from "@/song/sequencerStateMachine/states/resizeNoteRightState";
import { SelectNotesWithRectState } from "@/song/sequencerStateMachine/states/selectNotesWithRectState";
import { EditLyricState } from "@/song/sequencerStateMachine/states/editLyricState";
import { DrawPitchState } from "@/song/sequencerStateMachine/states/drawPitchState";
import { ErasePitchState } from "@/song/sequencerStateMachine/states/erasePitchState";

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
