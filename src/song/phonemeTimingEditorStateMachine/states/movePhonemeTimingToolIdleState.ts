import type { SetNextState, State } from "@/song/stateMachine";
import type {
  PhonemeTimingEditorContext,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingInfo,
} from "@/song/phonemeTimingEditorStateMachine/common";
import { isInPhonemeBandHitArea } from "@/song/phonemeTimingEditorStateMachine/common";
import { getButton, tickToBaseX } from "@/song/viewHelper";
import { secondToTick } from "@/song/music";

export class MovePhonemeTimingToolIdleState implements State<
  PhonemeTimingEditorStateDefinitions,
  PhonemeTimingEditorInput,
  PhonemeTimingEditorContext
> {
  readonly id = "movePhonemeTimingToolIdle";

  onEnter(context: PhonemeTimingEditorContext) {
    context.cursorState.value =
      context.activePhoneme.value == undefined ? "UNSET" : "EW_RESIZE";
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

    const event =
      input.type === "pointerEvent" ? input.pointerEvent : input.mouseEvent;
    if (
      event.type === "pointerleave" &&
      input.targetArea === "PhonemeTimingArea"
    ) {
      context.activePhoneme.value = undefined;
      context.cursorState.value = "UNSET";
      return;
    }
    const mouseButton = getButton(event);
    const selectedTrackId = context.selectedTrackId.value;

    const isPointerMove =
      event.type === "pointermove" && input.targetArea === "PhonemeTimingArea";
    const isPointerDown =
      event.type === "pointerdown" &&
      mouseButton === "LEFT_BUTTON" &&
      input.targetArea === "PhonemeTimingArea";

    const isDoubleClick =
      event.type === "dblclick" && mouseButton === "LEFT_BUTTON";

    if (!isPointerMove && !isPointerDown && !isDoubleClick) {
      return;
    }

    // ヒットテスト
    const threshold = 4;
    let nearest: PhonemeTimingInfo | undefined;
    let minDistance: number | undefined = undefined;
    if (
      isInPhonemeBandHitArea(input.positionY, context.getPhonemeBandYRange())
    ) {
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
    }

    if (isPointerMove) {
      const active = context.activePhoneme.value;
      if (nearest?.noteId == undefined) {
        context.activePhoneme.value = undefined;
      } else if (
        active?.noteId !== nearest.noteId ||
        active.phonemeIndexInNote !== nearest.phonemeIndexInNote
      ) {
        context.activePhoneme.value = {
          noteId: nearest.noteId,
          phonemeIndexInNote: nearest.phonemeIndexInNote,
        };
      }
    }

    if (nearest != undefined && nearest.noteId != undefined) {
      if (isPointerMove) {
        context.cursorState.value = "EW_RESIZE";
      } else if (isDoubleClick) {
        if (nearest.isEdited) {
          void context.store.actions.COMMAND_ERASE_PHONEME_TIMING_EDITS({
            trackId: selectedTrackId,
            targets: [
              {
                noteId: nearest.noteId,
                phonemeIndexInNote: nearest.phonemeIndexInNote,
              },
            ],
          });
        }
      } else {
        setNextState("movePhonemeTiming", {
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

  onExit(context: PhonemeTimingEditorContext) {
    context.cursorState.value = "UNSET";
    context.activePhoneme.value = undefined;
  }
}
