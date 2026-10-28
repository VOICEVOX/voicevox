import { nextTick, reactive, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useVolumeEditorStateMachine } from "@/composables/useVolumeEditorStateMachine";
import type { VolumeEditValue } from "@/domain/project/type";
import type {
  VolumeEditorInput,
  VolumeEditorPartialStore,
} from "@/song/volumeEditorStateMachine/common";
import { TrackId } from "@/type/preload";

const createStateMachine = () => {
  const editableRanges = ref([{ startFrame: 0, endFrame: 100 }]);
  const effectiveFramewise = ref<VolumeEditValue[]>(
    Array.from({ length: 100 }, () => 3),
  );
  const store = reactive<VolumeEditorPartialStore>({
    state: { sequencerVolumeTool: "DRAW" },
    getters: { SELECTED_TRACK_ID: TrackId("trackId") },
    actions: {
      COMMAND_SET_VOLUME_EDIT_DATA: vi.fn(),
      COMMAND_ERASE_VOLUME_EDIT_DATA: vi.fn(),
    },
  });
  const stateMachine = useVolumeEditorStateMachine(store, {
    getEditableFrameRanges: () => editableRanges.value,
    getEffectiveVolumeValue: (frame) => effectiveFramewise.value[frame],
  });
  return { ...stateMachine, store, editableRanges, effectiveFramewise };
};

const createPointerInput = (
  type: "pointermove" | "pointerleave",
  frame: number,
): VolumeEditorInput => ({
  type: "pointerEvent",
  targetArea: "VolumeEditorArea",
  pointerEvent: { type } as PointerEvent,
  pointerInfo: { position: { frame, value: 0 }, db: 0, x: 100, y: 60 },
});

describe("useVolumeEditorStateMachine", () => {
  it("消しゴムへの切り替えで描画用の強調を解除し、描画ツールの再ホバーで有効にする", async () => {
    const { stateMachineProcess, showDrawFeedback, store } =
      createStateMachine();

    stateMachineProcess(createPointerInput("pointermove", 10));
    expect(showDrawFeedback.value).toBe(true);

    store.state.sequencerVolumeTool = "ERASE";
    await nextTick();
    expect(showDrawFeedback.value).toBe(false);
    stateMachineProcess(createPointerInput("pointermove", 10));
    expect(showDrawFeedback.value).toBe(false);

    store.state.sequencerVolumeTool = "DRAW";
    await nextTick();
    expect(showDrawFeedback.value).toBe(false);
    stateMachineProcess(createPointerInput("pointermove", 10));
    expect(showDrawFeedback.value).toBe(true);
  });

  it("ホバー中のツールチップは、ポインタを動かさなくてもカーブの変更に追随する", () => {
    const { stateMachineProcess, tooltipData, effectiveFramewise } =
      createStateMachine();

    stateMachineProcess(createPointerInput("pointermove", 10));
    expect(tooltipData.value).toEqual({ db: 3, pointerX: 100, pointerY: 60 });

    effectiveFramewise.value = effectiveFramewise.value.map(() => -2);
    expect(tooltipData.value).toEqual({ db: -2, pointerX: 100, pointerY: 60 });

    stateMachineProcess(createPointerInput("pointerleave", 10));
    expect(tooltipData.value).toBeUndefined();
  });

  it("ホバー中の編集可能区間が消えると、ポインタを動かさなくてもツールチップが消える", () => {
    const {
      stateMachineProcess,
      tooltipData,
      editableRanges,
      effectiveFramewise,
    } = createStateMachine();

    stateMachineProcess(createPointerInput("pointermove", 10));
    expect(tooltipData.value).toBeDefined();

    // 表示データは編集可能区間外をnullで埋める
    editableRanges.value = [];
    effectiveFramewise.value = effectiveFramewise.value.map(() => null);
    expect(tooltipData.value).toBeUndefined();
  });
});
