import { computed, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  VolumeEditorContext,
  VolumeEditorPointerInfo,
} from "@/sing/volumeEditorStateMachine/common";
import { DrawVolumeState } from "@/sing/volumeEditorStateMachine/states/drawVolumeState";
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
});

function createContext(): VolumeEditorContext {
  return {
    previewVolumeEdit: ref(undefined),
    previewMode: ref("IDLE"),
    cursorState: ref("UNSET"),
    tooltipData: ref(undefined),
    selectedTrackId: computed(() => TrackId("trackId")),
    playheadTicks: computed(() => 0),
    tempos: computed(() => [{ position: 0, bpm: 120 }]),
    tpqn: computed(() => 480),
    zoomX: computed(() => 1),
    zoomY: computed(() => 1),
    nowPlaying: computed(() => false),
    getEditableFrameRanges: () => [{ startFrame: 0, endFrame: 100 }],
    store: {
      state: {
        tpqn: 480,
        tempos: [{ position: 0, bpm: 120 }],
        sequencerZoomX: 1,
        sequencerZoomY: 1,
        sequencerVolumeTool: "DRAW",
        nowPlaying: false,
      },
      getters: {
        SELECTED_TRACK_ID: TrackId("trackId"),
        PLAYHEAD_POSITION: 0,
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
