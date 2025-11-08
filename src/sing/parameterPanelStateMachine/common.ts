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

export type ParameterPanelInput =
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

export type ParameterPanelPreviewMode = "IDLE" | "VOLUME_DRAW" | "VOLUME_ERASE";

export type ParameterPanelRefs = {
  readonly previewVolumeEdit: Ref<ParameterPanelVolumePreviewEdit | undefined>;
  readonly previewMode: Ref<ParameterPanelPreviewMode>;
  readonly cursorState: Ref<CursorState>;
};

export type ParameterPanelComputedRefs = {
  readonly selectedTrackId: ComputedRef<TrackId>;
  readonly playheadTicks: ComputedRef<number>;
  readonly tempos: ComputedRef<Tempo[]>;
  readonly tpqn: ComputedRef<number>;
  readonly zoomX: ComputedRef<number>;
  readonly zoomY: ComputedRef<number>;
};

export type ParameterPanelPartialStore = {
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

export type ParameterPanelContext = ParameterPanelRefs &
  ParameterPanelComputedRefs & {
    readonly store: ParameterPanelPartialStore;
  };

export type ParameterPanelIdleStateId = "drawVolumeIdle" | "eraseVolumeIdle";

export type ParameterPanelStateDefinitions = StateDefinitions<
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
        returnStateId: ParameterPanelIdleStateId;
      };
    },
    {
      id: "eraseVolume";
      factoryArgs: {
        startPosition: PositionOnParameterPanel;
        targetTrackId: TrackId;
        returnStateId: ParameterPanelIdleStateId;
      };
    },
  ]
>;
