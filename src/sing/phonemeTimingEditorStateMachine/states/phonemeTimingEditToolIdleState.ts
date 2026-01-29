import { SetNextState, State } from "@/sing/stateMachine";
import {
  computePhonemeTimingLineInfos,
  findNearestPhonemeTimingLine,
  getPhraseInfosForTrack,
  PhonemeTimingEditorContext,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorStateDefinitions,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import { getButton } from "@/sing/viewHelper";

export class PhonemeTimingEditToolIdleState
  implements
    State<
      PhonemeTimingEditorStateDefinitions,
      PhonemeTimingEditorInput,
      PhonemeTimingEditorContext
    >
{
  readonly id = "phonemeTimingEditToolIdle";

  onEnter(context: PhonemeTimingEditorContext) {
    context.cursorState.value = "UNSET";
  }

  process({
    input,
    context,
    setNextState,
  }: {
    input: PhonemeTimingEditorInput;
    context: PhonemeTimingEditorContext;
    setNextState: SetNextState<PhonemeTimingEditorStateDefinitions>;
  }) {
    if (input.type === "pointerEvent") {
      const mouseButton = getButton(input.pointerEvent);
      const selectedTrackId = context.selectedTrackId.value;

      const isPointerMove = input.pointerEvent.type === "pointermove";
      const isPointerDown =
        input.pointerEvent.type === "pointerdown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "PhonemeTimingArea";

      if (isPointerMove || isPointerDown) {
        const phraseInfos = getPhraseInfosForTrack(
          context.store.state.phrases,
          context.store.state.phraseQueries,
          selectedTrackId,
        );
        const lineInfos = computePhonemeTimingLineInfos(
          phraseInfos,
          context.phonemeTimingEditData.value,
          context.tempos.value,
          context.tpqn.value,
          context.viewportInfo.value,
        );
        const nearestLine = findNearestPhonemeTimingLine(
          lineInfos,
          input.positionX,
          4,
        );

        if (isPointerMove) {
          // ホバー時のカーソル変更
          context.cursorState.value =
            nearestLine != undefined ? "EW_RESIZE" : "UNSET";
        } else if (nearestLine != undefined) {
          setNextState("phonemeTimingEdit", {
            targetTrackId: selectedTrackId,
            noteId: nearestLine.noteId,
            phonemeIndexInNote: nearestLine.phonemeIndexInNote,
            initialStartTimeSeconds: nearestLine.editedStartTimeSeconds,
            initialOffsetSeconds:
              nearestLine.editedStartTimeSeconds -
              nearestLine.originalStartTimeSeconds,
            hasExistingEdit: nearestLine.hasExistingEdit,
            minTimeSeconds: nearestLine.minTimeSeconds,
            maxTimeSeconds: nearestLine.maxTimeSeconds,
            startPositionX: input.positionX,
            returnStateId: this.id,
          });
        }
      }
    }
  }

  onExit(context: PhonemeTimingEditorContext) {
    context.cursorState.value = "UNSET";
  }
}
