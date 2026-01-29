import { ComputedRef, Ref } from "vue";
import type { Store } from "@/store";
import { StateDefinitions } from "@/sing/stateMachine";
import type { CursorState } from "@/sing/viewHelper";
import { TrackId } from "@/type/preload";
import type { Tempo } from "@/domain/project/type";

export type PositionOnVolumeEditor = {
  readonly frame: number;
  readonly value: number;
};

export type VolumeEditorInput =
  | {
      readonly type: "mouseEvent";
      readonly targetArea: "Editor";
      readonly mouseEvent: MouseEvent;
      readonly position: PositionOnVolumeEditor;
    }
  | {
      readonly type: "mouseEvent";
      readonly targetArea: "Window";
      readonly mouseEvent: MouseEvent;
      readonly position: PositionOnVolumeEditor;
    };

export type VolumePreviewEdit =
  | { type: "draw"; data: number[]; startFrame: number }
  | { type: "erase"; startFrame: number; frameLength: number };

export type VolumeEditorPreviewMode = "IDLE" | "VOLUME_DRAW" | "VOLUME_ERASE";

export type VolumeEditorRefs = {
  readonly previewVolumeEdit: Ref<VolumePreviewEdit | undefined>;
  readonly previewMode: Ref<VolumeEditorPreviewMode>;
  readonly cursorState: Ref<CursorState>;
};

export type VolumeEditorComputedRefs = {
  readonly selectedTrackId: ComputedRef<TrackId>;
  readonly playheadTicks: ComputedRef<number>;
  readonly tempos: ComputedRef<Tempo[]>;
  readonly tpqn: ComputedRef<number>;
  readonly zoomX: ComputedRef<number>;
  readonly zoomY: ComputedRef<number>;
};

export type VolumeEditorPartialStore = {
  readonly state: Pick<
    Store["state"],
    | "tpqn"
    | "tempos"
    | "sequencerZoomX"
    | "sequencerZoomY"
    | "sequencerVolumeTool"
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

export type VolumeEditorContext = VolumeEditorRefs &
  VolumeEditorComputedRefs & {
    readonly store: VolumeEditorPartialStore;
  };

export type VolumeEditorIdleStateId = "drawVolumeIdle" | "eraseVolumeIdle";

export type VolumeEditorStateDefinitions = StateDefinitions<
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
        startPosition: PositionOnVolumeEditor;
        targetTrackId: TrackId;
        returnStateId: VolumeEditorIdleStateId;
      };
    },
    {
      id: "eraseVolume";
      factoryArgs: {
        startPosition: PositionOnVolumeEditor;
        targetTrackId: TrackId;
        returnStateId: VolumeEditorIdleStateId;
      };
    },
  ]
>;
