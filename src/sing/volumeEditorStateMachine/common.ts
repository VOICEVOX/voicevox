import type { ComputedRef, Ref } from "vue";
import type { Store } from "@/store";
import type { StateDefinitions } from "@/sing/stateMachine";
import type { CursorState } from "@/sing/viewHelper";
import type { VolumeEditableFrameRange } from "@/sing/volumeEditRanges";
import type { TrackId } from "@/type/preload";
import type { Tempo } from "@/domain/project/type";

export type PositionOnVolumeEditor = {
  readonly frame: number;
  readonly value: number;
};

export type VolumeEditorPointerInfo = {
  readonly position: PositionOnVolumeEditor;
  readonly db: number;
  readonly x: number;
  readonly y: number;
};

export type VolumeEditorTooltipData = {
  readonly db: number;
  readonly pointerX: number;
  readonly pointerY: number;
};

export type VolumeEditorInput =
  | {
      readonly type: "pointerEvent";
      readonly targetArea: "VolumeEditorArea";
      readonly pointerEvent: PointerEvent;
      readonly pointerInfo: VolumeEditorPointerInfo;
    }
  | {
      readonly type: "pointerEvent";
      readonly targetArea: "Window";
      readonly pointerEvent: PointerEvent;
      readonly pointerInfo: VolumeEditorPointerInfo;
    };

export type VolumePreviewEdit =
  | { type: "draw"; data: number[]; startFrame: number }
  | { type: "erase"; startFrame: number; frameLength: number };

export type VolumeEditorPreviewMode = "IDLE" | "VOLUME_DRAW" | "VOLUME_ERASE";

export type VolumeEditorRefs = {
  readonly previewVolumeEdit: Ref<VolumePreviewEdit | undefined>;
  readonly previewMode: Ref<VolumeEditorPreviewMode>;
  readonly cursorState: Ref<CursorState>;
  readonly tooltipData: Ref<VolumeEditorTooltipData | undefined>;
};

export type VolumeEditorComputedRefs = {
  readonly selectedTrackId: ComputedRef<TrackId>;
  readonly playheadTicks: ComputedRef<number>;
  readonly tempos: ComputedRef<Tempo[]>;
  readonly tpqn: ComputedRef<number>;
  readonly zoomX: ComputedRef<number>;
  readonly zoomY: ComputedRef<number>;
  readonly nowPlaying: ComputedRef<boolean>;
};

export type VolumeEditorPartialStore = {
  readonly state: Pick<
    Store["state"],
    | "tpqn"
    | "tempos"
    | "sequencerZoomX"
    | "sequencerZoomY"
    | "sequencerVolumeTool"
    | "nowPlaying"
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
    readonly getEditableFrameRanges: () => readonly VolumeEditableFrameRange[];
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
        startTooltipData: VolumeEditorTooltipData;
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
