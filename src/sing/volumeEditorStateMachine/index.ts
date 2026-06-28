import type {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
  VolumeEditorIdleStateId,
} from "./common";
import { DrawVolumeIdleState } from "./states/drawVolumeIdleState";
import { EraseVolumeIdleState } from "./states/eraseVolumeIdleState";
import { SelectVolumeIdleState } from "./states/selectVolumeIdleState";
import { DrawVolumeState } from "./states/drawVolumeState";
import { EraseVolumeState } from "./states/eraseVolumeState";
import { StateMachine } from "@/sing/stateMachine";

export const createVolumeEditorStateMachine = (
  context: VolumeEditorContext,
  initialState: VolumeEditorIdleStateId,
) => {
  return new StateMachine<
    VolumeEditorStateDefinitions,
    VolumeEditorInput,
    VolumeEditorContext
  >(
    {
      selectVolumeIdle: () => new SelectVolumeIdleState(),
      drawVolumeIdle: () => new DrawVolumeIdleState(),
      eraseVolumeIdle: () => new EraseVolumeIdleState(),
      drawVolume: (args) => new DrawVolumeState(args),
      eraseVolume: (args) => new EraseVolumeState(args),
    },
    context,
    initialState,
  );
};
