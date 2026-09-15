import type {
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorContext,
  PhonemeTimingEditorIdleStateId,
} from "@/song/phonemeTimingEditorStateMachine/common";
import { MovePhonemeTimingToolIdleState } from "@/song/phonemeTimingEditorStateMachine/states/movePhonemeTimingToolIdleState";
import { MovePhonemeTimingState } from "@/song/phonemeTimingEditorStateMachine/states/movePhonemeTimingState";
import { ErasePhonemeTimingToolIdleState } from "@/song/phonemeTimingEditorStateMachine/states/erasePhonemeTimingToolIdleState";
import { ErasePhonemeTimingState } from "@/song/phonemeTimingEditorStateMachine/states/erasePhonemeTimingState";
import { StateMachine } from "@/song/stateMachine";

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
