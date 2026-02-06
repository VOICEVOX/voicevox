import { SetNextState, State } from "@/sing/stateMachine";
import {
  PhonemeTimingEditorContext,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorStateDefinitions,
} from "@/sing/phonemeTimingEditorStateMachine/common";
import { getButton, tickToBaseX } from "@/sing/viewHelper";
import { secondToTick } from "@/sing/music";

export class ErasePhonemeTimingToolIdleState
  implements
    State<
      PhonemeTimingEditorStateDefinitions,
      PhonemeTimingEditorInput,
      PhonemeTimingEditorContext
    >
{
  readonly id = "erasePhonemeTimingToolIdle";

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
    const phonemeTimingEditData = context.phonemeTimingEditData.value;

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

      // 編集済み音素タイミングのヒットテスト
      const threshold = 4;
      let isHitEditedPhonemeTiming = false;
      for (const phonemeTimingInfo of phonemeTimingInfos) {
        if (phonemeTimingInfo.noteId == undefined) {
          continue;
        }

        // 編集済みかどうか確認
        const phonemeTimingEdits = phonemeTimingEditData.get(
          phonemeTimingInfo.noteId,
        );
        const hasExistingEdit =
          phonemeTimingEdits?.some(
            (edit) =>
              edit.phonemeIndexInNote === phonemeTimingInfo.phonemeIndexInNote,
          ) ?? false;

        if (!hasExistingEdit) {
          continue;
        }

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
        if (distance <= threshold) {
          isHitEditedPhonemeTiming = true;
          break;
        }
      }

      if (isHitEditedPhonemeTiming) {
        if (isPointerMove) {
          context.cursorState.value = "CROSSHAIR";
        } else {
          setNextState("erasePhonemeTiming", {
            targetTrackId: selectedTrackId,
            startPositionX: input.positionX,
            returnStateId: this.id,
          });
        }
      } else if (isPointerMove) {
        context.cursorState.value = "UNSET";
      } else if (isPointerDown) {
        // 編集済み音素がない場所でクリックした場合でも削除状態に遷移
        // （ドラッグで他の編集済み音素を削除できるようにするため）
        setNextState("erasePhonemeTiming", {
          targetTrackId: selectedTrackId,
          startPositionX: input.positionX,
          returnStateId: this.id,
        });
      }
    }
  }

  onExit(context: PhonemeTimingEditorContext) {
    context.cursorState.value = "UNSET";
  }
}
