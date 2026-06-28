import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
} from "../common";
import type { State } from "@/sing/stateMachine";

export class SelectVolumeIdleState implements State<
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext
> {
  readonly id = "selectVolumeIdle";

  onEnter(context: VolumeEditorContext) {
    context.cursorState.value = "CROSSHAIR";
  }

  process() {
    // Range selection is a visual mock for now.
  }

  onExit(context: VolumeEditorContext) {
    context.cursorState.value = "UNSET";
  }
}
