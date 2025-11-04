import { ComputedRef, Ref } from "vue";
import type { Store } from "@/store";
import { StateDefinitions } from "@/sing/stateMachine";
import type { CursorState } from "@/sing/viewHelper";
import { TrackId } from "@/type/preload";
import type { Tempo } from "@/domain/project/type";

export type PositionOnParameterPanel = {
  readonly frame: number;
  readonly value: number;
};

export type ParameterPanelVolumeInput =
  | {
      readonly type: "mouseEvent";
      readonly targetArea: "Editor";
      readonly mouseEvent: MouseEvent;
      readonly position: PositionOnParameterPanel;
    }
  | {
      readonly type: "mouseEvent";
      readonly targetArea: "Window";
      readonly mouseEvent: MouseEvent;
      readonly position: PositionOnParameterPanel;
    };

export type ParameterPanelVolumePreviewEdit =
  | { type: "draw"; data: number[]; startFrame: number }
  | { type: "erase"; startFrame: number; frameLength: number };

export type ParameterPanelVolumePreviewMode =
  | "IDLE"
  | "VOLUME_DRAW"
  | "VOLUME_ERASE";

export type ParameterPanelVolumeRefs = {
  readonly previewVolumeEdit: Ref<ParameterPanelVolumePreviewEdit | undefined>;
  readonly previewMode: Ref<ParameterPanelVolumePreviewMode>;
  readonly cursorState: Ref<CursorState>;
};

export type ParameterPanelVolumeComputedRefs = {
  readonly selectedTrackId: ComputedRef<TrackId>;
  readonly playheadTicks: ComputedRef<number>;
  readonly tempos: ComputedRef<Tempo[]>;
  readonly tpqn: ComputedRef<number>;
  readonly zoomX: ComputedRef<number>;
  readonly zoomY: ComputedRef<number>;
};

export type ParameterPanelVolumePartialStore = {
  readonly state: Pick<
    Store["state"],
    | "tpqn"
    | "tempos"
    | "sequencerZoomX"
    | "sequencerZoomY"
    | "sequencerVolumeTool"
    | "parameterPanelEditTarget"
  >;
  readonly getters: Pick<
    Store["getters"],
    "SELECTED_TRACK_ID" | "PLAYHEAD_POSITION"
  >;
  readonly actions: Pick<
    Store["actions"],
    "COMMAND_SET_VOLUME_EDIT_DATA" | "COMMAND_ERASE_VOLUME_EDIT_DATA"
  >;
};

export type ParameterPanelVolumeContext = ParameterPanelVolumeRefs &
  ParameterPanelVolumeComputedRefs & {
    readonly store: ParameterPanelVolumePartialStore;
  };

export type ParameterPanelVolumeIdleStateId =
  | "drawVolumeIdle"
  | "eraseVolumeIdle";

export type ParameterPanelVolumeStateDefinitions = StateDefinitions<
  [
    {
      id: "drawVolumeIdle";
      factoryArgs: undefined;
    },
    {
      id: "eraseVolumeIdle";
      factoryArgs: undefined;
    },
    {
      id: "drawVolume";
      factoryArgs: {
        startPosition: PositionOnParameterPanel;
        targetTrackId: TrackId;
        returnStateId: ParameterPanelVolumeIdleStateId;
      };
    },
    {
      id: "eraseVolume";
      factoryArgs: {
        startPosition: PositionOnParameterPanel;
        targetTrackId: TrackId;
        returnStateId: ParameterPanelVolumeIdleStateId;
      };
    },
  ]
>;
