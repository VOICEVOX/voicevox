import { computed, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  PositionOnVolumeEditor,
  VolumeEditorContext,
} from "@/song/volumeEditorStateMachine/common";
import { relativeVolumeEditMode } from "@/song/volumeEditMode";
import { EraseVolumeState } from "@/song/volumeEditorStateMachine/states/eraseVolumeState";
import { TrackId } from "@/type/preload";

describe("EraseVolumeState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pointerup時にanimation frame待ちの確定位置を反映する", () => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const context = createContext();
    const state = new EraseVolumeState({
      startPosition: { frame: 10, db: 1 },
      targetTrackId: TrackId("trackId"),
      returnStateId: "eraseVolumeIdle",
    });

    state.onEnter(context);
    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Window",
        pointerEvent: { type: "pointermove", button: 0 } as PointerEvent,
        pointerInfo: createPointerInfo(12),
      },
      context,
      setNextState: vi.fn(),
    });
    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Window",
        pointerEvent: { type: "pointerup", button: 0 } as PointerEvent,
        pointerInfo: createPointerInfo(12),
      },
      context,
      setNextState: vi.fn(),
    });
    state.onExit(context);

    expect(
      context.store.actions.COMMAND_ERASE_VOLUME_EDIT_DATA,
    ).toHaveBeenCalledWith({
      ranges: [{ startFrame: 10, endFrame: 13 }],
      trackId: TrackId("trackId"),
    });
  });
});

function createContext(): VolumeEditorContext {
  return {
    previewVolumeEdit: ref(undefined),
    previewMode: ref("IDLE"),
    selectedTrackId: computed(() => TrackId("trackId")),
    getEditableFrameRanges: () => [{ startFrame: 0, endFrame: 100 }],
    volumeEditMode: relativeVolumeEditMode,
    store: {
      state: {
        sequencerVolumeTool: "ERASE",
      },
      getters: {
        SELECTED_TRACK_ID: TrackId("trackId"),
      },
      actions: {
        COMMAND_SET_VOLUME_EDIT_DATA: vi.fn(),
        COMMAND_ERASE_VOLUME_EDIT_DATA: vi.fn(),
      },
    },
  };
}

function createPointerInfo(frame: number): PositionOnVolumeEditor {
  return { frame, db: 1 };
}
