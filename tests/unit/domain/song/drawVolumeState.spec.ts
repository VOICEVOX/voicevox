import { computed, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  PositionOnVolumeEditor,
  VolumeEditorContext,
} from "@/song/volumeEditorStateMachine/common";
import { relativeVolumeEditMode } from "@/song/volumeEditMode";
import { DrawVolumeState } from "@/song/volumeEditorStateMachine/states/drawVolumeState";
import { TrackId } from "@/type/preload";

describe("DrawVolumeState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("左方向へ戻しながら描画しても補間できる", () => {
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        animationFrameCallbacks.push(callback);
        return animationFrameCallbacks.length;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const context = createContext();
    const state = new DrawVolumeState({
      startPosition: { frame: 10, db: 0 },
      targetTrackId: TrackId("trackId"),
      returnStateId: "drawVolumeIdle",
    });

    state.onEnter(context);
    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Window",
        pointerEvent: { type: "pointermove", button: 0 } as PointerEvent,
        pointerInfo: createPointerInfo(8, 6),
      },
      context,
      setNextState: vi.fn(),
    });

    expect(() => animationFrameCallbacks[0]?.(0)).not.toThrow();
    expect(context.previewVolumeEdit.value).toEqual({
      type: "draw",
      startFrame: 8,
      data: [6, 3, 0],
    });
  });

  it("pointerup時にanimation frame待ちの確定位置を反映する", () => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const context = createContext();
    const state = new DrawVolumeState({
      startPosition: { frame: 10, db: 0 },
      targetTrackId: TrackId("trackId"),
      returnStateId: "drawVolumeIdle",
    });

    state.onEnter(context);
    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Window",
        pointerEvent: { type: "pointermove", button: 0 } as PointerEvent,
        pointerInfo: createPointerInfo(12, 6),
      },
      context,
      setNextState: vi.fn(),
    });
    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Window",
        pointerEvent: { type: "pointerup", button: 0 } as PointerEvent,
        pointerInfo: createPointerInfo(12, 6),
      },
      context,
      setNextState: vi.fn(),
    });
    state.onExit(context);

    expect(
      context.store.actions.COMMAND_SET_VOLUME_EDIT_DATA,
    ).toHaveBeenCalledWith({
      volumeArray: [0, 3, 6],
      startFrame: 10,
      trackId: TrackId("trackId"),
    });
  });
});

function createContext(
  editableRanges = [{ startFrame: 0, endFrame: 100 }],
): VolumeEditorContext {
  return {
    previewVolumeEdit: ref(undefined),
    previewMode: ref("IDLE"),
    selectedTrackId: computed(() => TrackId("trackId")),
    getEditableFrameRanges: () => editableRanges,
    volumeEditMode: relativeVolumeEditMode,
    store: {
      state: {
        sequencerVolumeTool: "DRAW",
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

function createPointerInfo(frame: number, db: number): PositionOnVolumeEditor {
  return { frame, db };
}
