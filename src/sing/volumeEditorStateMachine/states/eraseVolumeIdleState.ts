import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
} from "../common";
import { applyEditableCursorState } from "../common";
import type { SetNextState, State } from "@/sing/stateMachine";
import { getButton } from "@/sing/viewHelper";
import { isFrameInVolumeEditableRange } from "@/sing/volumeEditRanges";

export class EraseVolumeIdleState implements State<
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext
> {
  readonly id = "eraseVolumeIdle";

  onEnter(context: VolumeEditorContext) {
    context.cursorState.value = "ERASE";
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

    // エディタ外へ出たらカーソルを既定（削除）へ戻す
    if (pointerEvent.type === "pointerleave") {
      context.cursorState.value = "ERASE";
      return;
    }

    const isEditable = isFrameInVolumeEditableRange(
      position.frame,
      context.getEditableFrameRanges(),
    );
    applyEditableCursorState(context, isEditable, "ERASE");

    if (
      pointerEvent.type === "pointerdown" &&
      getButton(pointerEvent) === "LEFT_BUTTON" &&
      isEditable
    ) {
      setNextState("eraseVolume", {
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
