import { computed, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  VolumeEditorContext,
  VolumeEditorPointerInfo,
} from "@/sing/volumeEditorStateMachine/common";
import { EraseVolumeIdleState } from "@/sing/volumeEditorStateMachine/states/eraseVolumeIdleState";
import { EraseVolumeState } from "@/sing/volumeEditorStateMachine/states/eraseVolumeState";
import { TrackId } from "@/type/preload";

describe("EraseVolumeState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("idle中はポインタ位置の編集可能区間をハイライトする", () => {
    const context = createContext();
    const state = new EraseVolumeIdleState();

    state.onEnter(context);
    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "VolumeEditorArea",
        pointerEvent: { type: "pointermove" } as PointerEvent,
        pointerInfo: createPointerInfo(10),
      },
      context,
      setNextState: vi.fn(),
    });

    expect(context.cursorState.value).toBe("ERASE");
    expect(context.highlightedFrame.value).toBe(10);
  });

  it("pointerup時にanimation frame待ちの確定位置を反映する", () => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const context = createContext();
    context.highlightedFrame.value = 10;
    const state = new EraseVolumeState({
      startPosition: { frame: 10, value: 1 },
      targetTrackId: TrackId("trackId"),
      returnStateId: "eraseVolumeIdle",
    });

    state.onEnter(context);
    expect(context.highlightedFrame.value).toBeUndefined();
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

    expect(context.tooltipData.value).toBeUndefined();

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
    cursorState: ref("UNSET"),
    tooltipData: ref(undefined),
    highlightedFrame: ref(undefined),
    selectedTrackId: computed(() => TrackId("trackId")),
    getEditableFrameRanges: () => [{ startFrame: 0, endFrame: 100 }],
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

function createPointerInfo(frame: number): VolumeEditorPointerInfo {
  return {
    position: { frame, value: 1 },
    db: 0,
    x: 100,
    y: 50,
  };
}
