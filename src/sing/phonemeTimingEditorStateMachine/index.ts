import {
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorContext,
  PhonemeTimingEditorIdleStateId,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import { PhonemeTimingEditToolIdleState } from "@/sing/phonemeTimingEditorStateMachine/states/phonemeTimingEditToolIdleState";
import { PhonemeTimingEditState } from "@/sing/phonemeTimingEditorStateMachine/states/phonemeTimingEditState";
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
      phonemeTimingEditToolIdle: () => new PhonemeTimingEditToolIdleState(),
      phonemeTimingEdit: (args) => new PhonemeTimingEditState(args),
    },
    context,
    initialState,
  );
};
