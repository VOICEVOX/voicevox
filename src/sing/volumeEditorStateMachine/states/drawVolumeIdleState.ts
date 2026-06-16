import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
} from "../common";
import { updateCursorStateForEditableRange } from "../common";
import type { SetNextState, State } from "@/sing/stateMachine";
import { getButton } from "@/sing/viewHelper";
import { isFrameInVolumeEditableRange } from "@/sing/volumeEditRanges";

export class DrawVolumeIdleState implements State<
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext
> {
  readonly id = "drawVolumeIdle";

  onEnter(context: VolumeEditorContext) {
    context.cursorState.value = "DRAW";
  }

  process({
    input,
    context,
    setNextState,
  }: {
    input: VolumeEditorInput;
    context: VolumeEditorContext;
    setNextState: SetNextState<VolumeEditorStateDefinitions>;
  }) {
    if (input.type !== "pointerEvent") {
      return;
    }
    if (input.targetArea !== "Editor") {
      return;
    }

    const { pointerEvent, position } = input;

    // エディタ外へ出たらカーソルを既定（描画）へ戻す
    if (pointerEvent.type === "pointerleave") {
      context.cursorState.value = "DRAW";
      return;
    }

    const isEditable = isFrameInVolumeEditableRange(
      position.frame,
      context.getEditableFrameRanges(),
    );
    updateCursorStateForEditableRange(context, isEditable, "DRAW");

    if (
      pointerEvent.type === "pointerdown" &&
      getButton(pointerEvent) === "LEFT_BUTTON" &&
      isEditable
    ) {
      setNextState("drawVolume", {
        startPosition: position,
        targetTrackId: context.selectedTrackId.value,
        returnStateId: this.id,
      });
    }
  }

  onExit(context: VolumeEditorContext) {
    context.cursorState.value = "UNSET";
  }
}
