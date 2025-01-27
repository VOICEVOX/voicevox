import {
  Context,
  Input,
  SequencerStateDefinitions,
} from "@/sing/sequencerStateMachine/common";
import { StateMachine } from "@/sing/stateMachine";

import { IdleState } from "@/sing/sequencerStateMachine/states/idleState";
import { AddNoteState } from "@/sing/sequencerStateMachine/states/addNoteState";
import { MoveNoteState } from "@/sing/sequencerStateMachine/states/moveNoteState";
import { ResizeNoteLeftState } from "@/sing/sequencerStateMachine/states/resizeNoteLeftState";
import { ResizeNoteRightState } from "@/sing/sequencerStateMachine/states/resizeNoteRightState";
import { SelectNotesWithRectState } from "@/sing/sequencerStateMachine/states/selectNotesWithRectState";
import { DrawPitchState } from "@/sing/sequencerStateMachine/states/drawPitchState";
import { ErasePitchState } from "@/sing/sequencerStateMachine/states/erasePitchState";

export const createSequencerStateMachine = (context: Context) => {
  return new StateMachine<SequencerStateDefinitions, Input, Context>(
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
    context,
  );
};
