import {
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorContext,
  PhonemeTimingEditorIdleStateId,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import { MovePhonemeTimingToolIdleState } from "@/sing/phonemeTimingEditorStateMachine/states/movePhonemeTimingToolIdleState";
import { MovePhonemeTimingState } from "@/sing/phonemeTimingEditorStateMachine/states/movePhonemeTimingState";
import { ErasePhonemeTimingToolIdleState } from "@/sing/phonemeTimingEditorStateMachine/states/erasePhonemeTimingToolIdleState";
import { ErasePhonemeTimingState } from "@/sing/phonemeTimingEditorStateMachine/states/erasePhonemeTimingState";
import { StateMachine } from "@/sing/stateMachine";

export const createPhonemeTimingEditorStateMachine = (
  context: PhonemeTimingEditorContext,
  initialState: PhonemeTimingEditorIdleStateId,
) => {
  return new StateMachine<
    PhonemeTimingEditorStateDefinitions,
    PhonemeTimingEditorInput,
    PhonemeTimingEditorContext
  >(
    {
      movePhonemeTimingToolIdle: () => new MovePhonemeTimingToolIdleState(),
      movePhonemeTiming: (args) => new MovePhonemeTimingState(args),
      erasePhonemeTimingToolIdle: () => new ErasePhonemeTimingToolIdleState(),
      erasePhonemeTiming: (args) => new ErasePhonemeTimingState(args),
    },
    context,
    initialState,
  );
};
