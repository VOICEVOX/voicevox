import { computed, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decibelToLinear } from "@/sing/audio";
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

  it("ポインタ位置に応じたカーソル状態をステートマシンで管理する", () => {
    const context = createContext();
    const state = new DrawVolumeIdleState();
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
        pointerInfo: createPointerInfo(10, 0),
      },
      context,
      setNextState,
    });
    expect(context.cursorState.value).toBe("DRAW");

    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Editor",
        pointerEvent: { type: "pointermove" } as PointerEvent,
        pointerInfo: createPointerInfo(101, 0),
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
          ...createPointerInfo(10, 0),
          isInParameterArea: false,
        },
      },
      context,
      setNextState,
    });
    expect(context.cursorState.value).toBe("UNSET");
  });

  it("描画状態への遷移時にツールチップの開始データも渡す", () => {
    const context = createContext();
    const state = new DrawVolumeIdleState();
    const setNextState = vi.fn();
    const pointerInfo = createPointerInfo(10, -6);

    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Editor",
        pointerEvent: {
          type: "pointerdown",
          button: 0,
        } as PointerEvent,
        pointerInfo,
      },
      context,
      setNextState,
    });

    expect(setNextState).toHaveBeenCalledWith("drawVolume", {
      startPosition: pointerInfo.position,
      startTooltipData: {
        db: -6,
        pointerX: 100,
        pointerY: 60,
      },
      targetTrackId: TrackId("trackId"),
      returnStateId: "drawVolumeIdle",
    });
  });

  it("描画中のツールチップを編集可能範囲に応じて更新する", () => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const context = createContext();
    const state = new DrawVolumeState({
      startPosition: { frame: 10, value: decibelToLinear(0) },
      startTooltipData: { db: 0, pointerX: 100, pointerY: 50 },
      targetTrackId: TrackId("trackId"),
      returnStateId: "drawVolumeIdle",
    });

    state.onEnter(context);
    expect(context.cursorState.value).toBe("DRAW");
    expect(context.tooltipData.value).toEqual({
      db: 0,
      pointerX: 100,
      pointerY: 50,
    });

    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Window",
        pointerEvent: { type: "pointermove", button: 0 } as PointerEvent,
        pointerInfo: createPointerInfo(12, -6),
      },
      context,
      setNextState: vi.fn(),
    });
    expect(context.tooltipData.value).toEqual({
      db: -6,
      pointerX: 120,
      pointerY: 60,
    });

    state.process({
      input: {
        type: "pointerEvent",
        targetArea: "Window",
        pointerEvent: { type: "pointermove", button: 0 } as PointerEvent,
        pointerInfo: createPointerInfo(101, -6),
      },
      context,
      setNextState: vi.fn(),
    });
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
    position: { frame, value: decibelToLinear(db) },
    db,
    isInParameterArea: true,
    x: frame * 10,
    y: 60,
  };
}
