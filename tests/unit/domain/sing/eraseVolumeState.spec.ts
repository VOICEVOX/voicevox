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

  it("ポインタ位置に応じたカーソル状態をステートマシンで管理する", () => {
    const context = createContext();
    const state = new EraseVolumeIdleState();
    const setNextState = vi.fn();

    context.tooltipData.value = { db: 0, pointerX: 100, pointerY: 50 };
    state.onEnter(context);
    expect(context.cursorState.value).toBe("UNSET");
    expect(context.tooltipData.value).toBeUndefined();

    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Editor",
        pointerEvent: { type: "pointermove" } as PointerEvent,
        pointerInfo: createPointerInfo(10),
      },
      context,
      setNextState,
    });
    expect(context.cursorState.value).toBe("ERASE");

    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Editor",
        pointerEvent: { type: "pointermove" } as PointerEvent,
        pointerInfo: createPointerInfo(101),
      },
      context,
      setNextState,
    });
    expect(context.cursorState.value).toBe("NOT_ALLOWED");

    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Editor",
        pointerEvent: { type: "pointermove" } as PointerEvent,
        pointerInfo: {
          ...createPointerInfo(10),
          isInParameterArea: false,
        },
      },
      context,
      setNextState,
    });
    expect(context.cursorState.value).toBe("UNSET");
  });

  it("削除状態ではツールチップを表示しない", () => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const context = createContext();
    const state = new EraseVolumeState({
      startPosition: { frame: 10, value: 1 },
      targetTrackId: TrackId("trackId"),
      returnStateId: "eraseVolumeIdle",
    });
    context.tooltipData.value = { db: 0, pointerX: 100, pointerY: 50 };

    state.onEnter(context);
    expect(context.tooltipData.value).toBeUndefined();

    state.onExit(context);
    expect(context.tooltipData.value).toBeUndefined();
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
        sequencerVolumeTool: "ERASE",
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

function createPointerInfo(frame: number): VolumeEditorPointerInfo {
  return {
    position: { frame, value: 1 },
    db: 0,
    isInParameterArea: true,
    x: 100,
    y: 50,
  };
}
