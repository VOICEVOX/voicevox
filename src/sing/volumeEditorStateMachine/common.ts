import { Ref } from "vue";
import type { Store } from "@/store";
import { StateDefinitions } from "@/sing/stateMachine";
import type { CursorState } from "@/sing/viewHelper";
import { TrackId } from "@/type/preload";
import type { Tempo } from "@/domain/project/type";

export type VolumeEditorPosition = {
  readonly frame: number;
  readonly amplitude: number;
};

export type VolumeEditorInput =
  | {
      readonly type: "mouseEvent";
      readonly targetArea: "Editor";
      readonly mouseEvent: MouseEvent;
      readonly position: VolumeEditorPosition;
    }
  | {
      readonly type: "mouseEvent";
      readonly targetArea: "Window";
      readonly mouseEvent: MouseEvent;
      readonly position: VolumeEditorPosition;
    };

export type PreviewVolumeEdit =
  | { type: "draw"; data: number[]; startFrame: number }
  | { type: "erase"; startFrame: number; frameLength: number };

export type VolumePreviewMode = "IDLE" | "DRAW_VOLUME" | "ERASE_VOLUME";

export type VolumeEditorRefs = {
  readonly previewVolumeEdit: Ref<PreviewVolumeEdit | undefined>;
  readonly previewMode: Ref<VolumePreviewMode>;
  readonly cursorState: Ref<CursorState>;
};

export type VolumeEditorPartialStore = {
  state: Pick<
    Store["state"],
    | "tpqn"
    | "tempos"
    | "sequencerZoomX"
    | "sequencerZoomY"
    | "sequencerVolumeTool"
  >;
  getters: Pick<Store["getters"], "SELECTED_TRACK_ID" | "PLAYHEAD_POSITION">;
  actions: Pick<
    Store["actions"],
    "COMMAND_SET_VOLUME_EDIT_DATA" | "COMMAND_ERASE_VOLUME_EDIT_DATA"
  >;
};

export type VolumeEditorContext = VolumeEditorRefs & {
  readonly getSelectedTrackId: () => TrackId;
  readonly playheadTicks: () => number;
  readonly tempos: () => Tempo[];
  readonly tpqn: () => number;
  readonly zoomX: () => number;
  readonly zoomY: () => number;
  readonly setVolumeEditData: (args: {
    volumeArray: number[];
    startFrame: number;
    trackId: TrackId;
  }) => Promise<void>;
  readonly eraseVolumeEditData: (args: {
    startFrame: number;
    frameLength: number;
    trackId: TrackId;
  }) => Promise<void>;
};

export type IdleStateId = "drawVolumeIdle" | "eraseVolumeIdle";

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
        startPosition: VolumeEditorPosition;
        trackId: TrackId;
        returnStateId: IdleStateId;
      };
    },
    {
      id: "eraseVolume";
      factoryArgs: {
        startPosition: VolumeEditorPosition;
        trackId: TrackId;
        returnStateId: IdleStateId;
      };
    },
  ]
>;
