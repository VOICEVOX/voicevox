import { SetNextState, State } from "@/sing/stateMachine";
import {
  PhonemeTimingEditorContext,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingInfo,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import { getButton, tickToBaseX } from "@/sing/viewHelper";
import { secondToTick } from "@/sing/music";

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
    const viewportInfo = context.viewportInfo.value;
    const phonemeTimingInfos = context.phonemeTimingInfos.value;

    if (input.type === "pointerEvent") {
      const mouseButton = getButton(input.pointerEvent);
      const selectedTrackId = context.selectedTrackId.value;

      const isPointerMove = input.pointerEvent.type === "pointermove";
      const isPointerDown =
        input.pointerEvent.type === "pointerdown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "PhonemeTimingArea";

      if (!isPointerMove && !isPointerDown) {
        return;
      }

      // ヒットテスト
      const threshold = 4;
      let nearest: PhonemeTimingInfo | undefined;
      let minDistance: number | undefined = undefined;
      for (const phonemeTimingInfo of phonemeTimingInfos) {
        const phonemeStartTicks = secondToTick(
          phonemeTimingInfo.editedStartTimeSeconds,
          context.tempos.value,
          context.tpqn.value,
        );
        const phonemeStartBaseX = tickToBaseX(
          phonemeStartTicks,
          context.tpqn.value,
        );
        const phonemeStartX = Math.round(
          phonemeStartBaseX * viewportInfo.scaleX - viewportInfo.offsetX,
        );

        const distance = Math.abs(phonemeStartX - input.positionX);
        if (
          distance <= threshold &&
          (minDistance == undefined || distance < minDistance)
        ) {
          minDistance = distance;
          nearest = phonemeTimingInfo;
        }
      }

      if (nearest != undefined && nearest.noteId != undefined) {
        if (isPointerMove) {
          context.cursorState.value = "EW_RESIZE";
        } else {
          setNextState("phonemeTimingEdit", {
            targetTrackId: selectedTrackId,
            noteId: nearest.noteId,
            phonemeIndexInNote: nearest.phonemeIndexInNote,
            startPositionX: input.positionX,
            returnStateId: this.id,
          });
        }
      } else if (isPointerMove) {
        context.cursorState.value = "UNSET";
      }
    }
  }

  onExit(context: PhonemeTimingEditorContext) {
    context.cursorState.value = "UNSET";
  }
}
