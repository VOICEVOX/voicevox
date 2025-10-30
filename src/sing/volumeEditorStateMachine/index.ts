import {
  VolumeEditorStateDefinitions,
  VolumeEditorInput,
  VolumeEditorContext,
  IdleStateId,
} from "./common";
import { DrawVolumeIdleState } from "./states/drawVolumeIdleState";
import { EraseVolumeIdleState } from "./states/eraseVolumeIdleState";
import { DrawVolumeState } from "./states/drawVolumeState";
import { EraseVolumeState } from "./states/eraseVolumeState";
import { StateMachine } from "@/sing/stateMachine";

export const createVolumeEditorStateMachine = (
  context: VolumeEditorContext,
  initialState: IdleStateId,
) => {
  return new StateMachine<
    VolumeEditorStateDefinitions,
    VolumeEditorInput,
    VolumeEditorContext
  >(
    {
      drawVolumeIdle: () => new DrawVolumeIdleState(),
      eraseVolumeIdle: () => new EraseVolumeIdleState(),
      drawVolume: (args) => new DrawVolumeState(args),
      eraseVolume: (args) => new EraseVolumeState(args),
    },
    context,
    initialState,
  );
};
