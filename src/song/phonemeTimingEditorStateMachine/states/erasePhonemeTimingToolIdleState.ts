import type { SetNextState, State } from "@/song/stateMachine";
import type {
  PhonemeTimingEditorContext,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingTarget,
} from "@/song/phonemeTimingEditorStateMachine/common";
import { isInPhonemeBandHitArea } from "@/song/phonemeTimingEditorStateMachine/common";
import { getButton, tickToBaseX } from "@/song/viewHelper";
import { secondToTick } from "@/song/music";

export class ErasePhonemeTimingToolIdleState implements State<
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorContext
> {
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

      if (
        input.pointerEvent.type === "pointerleave" &&
        input.targetArea === "PhonemeTimingArea"
      ) {
        context.activePhoneme.value = undefined;
        context.cursorState.value = "UNSET";
        return;
      }

      const isPointerMove =
        input.pointerEvent.type === "pointermove" &&
        input.targetArea === "PhonemeTimingArea";
      const isPointerDown =
        input.pointerEvent.type === "pointerdown" &&
        mouseButton === "LEFT_BUTTON" &&
        input.targetArea === "PhonemeTimingArea";

      if (!isPointerMove && !isPointerDown) {
        return;
      }

      // 帯の外では強調表示もカーソルも変えず、消去も始めない
      if (
        !isInPhonemeBandHitArea(
          input.positionY,
          context.phonemeBandYRange.value,
        )
      ) {
        if (isPointerMove) {
          context.activePhoneme.value = undefined;
          context.cursorState.value = "UNSET";
        }
        return;
      }

      if (isPointerDown) {
        // 編集済み音素がない場所でクリックした場合でも削除状態に遷移
        // （ドラッグで他の編集済み音素を削除できるようにするため）
        setNextState("erasePhonemeTiming", {
          targetTrackId: selectedTrackId,
          startPositionX: input.positionX,
          returnStateId: this.id,
        });
        return;
      }

      // 編集済み音素タイミングのうち、最も近いものを消去の対象として示す
      const threshold = 4;
      let nearest: PhonemeTimingTarget | undefined;
      let minDistance: number | undefined;
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
        if (
          distance <= threshold &&
          (minDistance == undefined || distance < minDistance)
        ) {
          minDistance = distance;
          nearest = {
            noteId: phonemeTimingInfo.noteId,
            phonemeIndexInNote: phonemeTimingInfo.phonemeIndexInNote,
          };
        }
      }

      const active = context.activePhoneme.value;
      if (
        active?.noteId !== nearest?.noteId ||
        active?.phonemeIndexInNote !== nearest?.phonemeIndexInNote
      ) {
        context.activePhoneme.value = nearest;
      }
      context.cursorState.value = nearest == undefined ? "UNSET" : "ERASE";
    }
  }

  onExit(context: PhonemeTimingEditorContext) {
    context.cursorState.value = "UNSET";
    context.activePhoneme.value = undefined;
  }
}
