import { StateMachine } from "../stateMachine";
import type {
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorContext,
  PhonemeTimingEditorIdleStateId,
} from "./common";
import { MovePhonemeTimingToolIdleState } from "./states/movePhonemeTimingToolIdleState";
import { MovePhonemeTimingState } from "./states/movePhonemeTimingState";
import { ErasePhonemeTimingToolIdleState } from "./states/erasePhonemeTimingToolIdleState";
import { ErasePhonemeTimingState } from "./states/erasePhonemeTimingState";

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
