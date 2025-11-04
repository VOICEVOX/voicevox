import {
  ParameterPanelVolumeStateDefinitions,
  ParameterPanelVolumeInput,
  ParameterPanelVolumeContext,
  ParameterPanelVolumeIdleStateId,
} from "./common";
import { DrawVolumeIdleState } from "./states/drawVolumeIdleState";
import { EraseVolumeIdleState } from "./states/eraseVolumeIdleState";
import { DrawVolumeState } from "./states/drawVolumeState";
import { EraseVolumeState } from "./states/eraseVolumeState";
import { StateMachine } from "@/sing/stateMachine";

export const createParameterPanelVolumeStateMachine = (
  context: ParameterPanelVolumeContext,
  initialState: ParameterPanelVolumeIdleStateId,
) => {
  return new StateMachine<
    ParameterPanelVolumeStateDefinitions,
    ParameterPanelVolumeInput,
    ParameterPanelVolumeContext
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
