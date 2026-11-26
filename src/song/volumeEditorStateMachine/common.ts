import type { ComputedRef, Ref } from "vue";
import type { Store } from "@/store";
import type { StateDefinitions } from "@/song/stateMachine";
import type { VolumeEditMode } from "@/song/volumeEditMode";
import type { VolumeEditableFrameRange } from "@/song/volumeEditRanges";
import type { TrackId } from "@/type/preload";

export type PositionOnVolumeEditor = {
  readonly frame: number;
  readonly db: number;
};

export type VolumeEditorInput =
  | {
      readonly type: "pointerEvent";
      readonly targetArea: "VolumeEditorArea";
      readonly pointerEvent: PointerEvent;
      readonly pointerInfo: PositionOnVolumeEditor;
    }
  | {
      readonly type: "pointerEvent";
      readonly targetArea: "Window";
      readonly pointerEvent: PointerEvent;
      readonly pointerInfo: PositionOnVolumeEditor;
    };

export type VolumePreviewEdit =
  | { type: "draw"; data: number[]; startFrame: number }
  | { type: "erase"; startFrame: number; frameLength: number };

export type VolumeEditorPreviewMode = "IDLE" | "VOLUME_DRAW" | "VOLUME_ERASE";

export type VolumeEditorRefs = {
  readonly previewVolumeEdit: Ref<VolumePreviewEdit | undefined>;
  readonly previewMode: Ref<VolumeEditorPreviewMode>;
};

export type VolumeEditorComputedRefs = {
  readonly selectedTrackId: ComputedRef<TrackId>;
};

export type VolumeEditorPartialStore = {
  readonly state: Pick<Store["state"], "sequencerVolumeTool">;
  readonly getters: Pick<Store["getters"], "SELECTED_TRACK_ID">;
  readonly actions: Pick<
    Store["actions"],
    "COMMAND_SET_VOLUME_EDIT_DATA" | "COMMAND_ERASE_VOLUME_EDIT_DATA"
  >;
};

export type VolumeEditorContext = VolumeEditorRefs &
  VolumeEditorComputedRefs & {
    readonly getEditableFrameRanges: () => readonly VolumeEditableFrameRange[];
    readonly volumeEditMode: VolumeEditMode;
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
