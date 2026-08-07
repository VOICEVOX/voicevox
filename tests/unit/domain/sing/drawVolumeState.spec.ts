import { computed, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  VolumeEditorContext,
  VolumeEditorPointerInfo,
} from "@/sing/volumeEditorStateMachine/common";
import { DrawVolumeIdleState } from "@/sing/volumeEditorStateMachine/states/drawVolumeIdleState";
import { DrawVolumeState } from "@/sing/volumeEditorStateMachine/states/drawVolumeState";
import { TrackId } from "@/type/preload";

describe("DrawVolumeState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("idle中はポインタ位置の編集可能区間をハイライトする", () => {
    const context = createContext();
    const state = new DrawVolumeIdleState();

    state.onEnter(context);
    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "VolumeEditorArea",
        pointerEvent: { type: "pointermove" } as PointerEvent,
        pointerInfo: createPointerInfo(10, 0),
      },
      context,
      setNextState: vi.fn(),
    });

    expect(context.cursorState.value).toBe("DRAW");
    expect(context.highlightedFrame.value).toBe(10);

    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "VolumeEditorArea",
        pointerEvent: { type: "pointerleave" } as PointerEvent,
        pointerInfo: createPointerInfo(10, 0),
      },
      context,
      setNextState: vi.fn(),
    });

    expect(context.cursorState.value).toBe("UNSET");
    expect(context.highlightedFrame.value).toBeUndefined();
  });

  it("描画中は現在の編集可能区間へハイライトを追随させる", () => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const context = createContext([
      { startFrame: 0, endFrame: 50 },
      { startFrame: 100, endFrame: 200 },
    ]);
    const state = new DrawVolumeState({
      startPosition: { frame: 10, value: 0 },
      startTooltipData: { db: 0, pointerX: 100, pointerY: 50 },
      targetTrackId: TrackId("trackId"),
      returnStateId: "drawVolumeIdle",
    });

    state.onEnter(context);
    expect(context.highlightedFrame.value).toBe(10);

    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Window",
        pointerEvent: { type: "pointermove", button: 0 } as PointerEvent,
        pointerInfo: createPointerInfo(120, 0),
      },
      context,
      setNextState: vi.fn(),
    });

    expect(context.highlightedFrame.value).toBe(120);

    state.onExit(context);
    expect(context.highlightedFrame.value).toBeUndefined();
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
      startPosition: { frame: 10, value: 0 },
      startTooltipData: { db: 0, pointerX: 100, pointerY: 50 },
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
      startPosition: { frame: 10, value: 0 },
      startTooltipData: { db: 0, pointerX: 100, pointerY: 50 },
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

    expect(context.tooltipData.value).toBeUndefined();

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
    cursorState: ref("UNSET"),
    tooltipData: ref(undefined),
    highlightedFrame: ref(undefined),
    selectedTrackId: computed(() => TrackId("trackId")),
    getEditableFrameRanges: () => editableRanges,
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

function createPointerInfo(frame: number, db: number): VolumeEditorPointerInfo {
  return {
    position: { frame, value: db },
    db,
    x: frame * 10,
    y: 60,
  };
}
