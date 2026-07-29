import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  useVolumeEditorPointerInput,
  type VolumeEditorPointerEvent,
} from "@/components/Sing/SequencerVolumeEditor/useVolumeEditorPointerInput";
import { relativeVolumeEditMode } from "@/sing/volumeEditMode";
import type { VolumeEditorPreviewMode } from "@/sing/volumeEditorStateMachine/common";

describe("useVolumeEditorPointerInput", () => {
  it("ポインタイベントをエディタの座標と編集値へ変換する", () => {
    const previewMode = ref<VolumeEditorPreviewMode>("IDLE");
    const onPointerEvent = vi.fn<(event: VolumeEditorPointerEvent) => void>();
    let pointerInput:
      | ReturnType<typeof useVolumeEditorPointerInput>
      | undefined;

    const wrapper = mount(
      defineComponent({
        setup() {
          const mountedPointerInput = useVolumeEditorPointerInput({
            previewMode,
            viewportInfo: ref({
              scaleX: 1,
              scaleY: 1,
              offsetX: 0,
              offsetY: 0,
            }),
            tempos: ref([{ position: 0, bpm: 120 }]),
            tpqn: ref(480),
            frameRate: ref(93.75),
            volumeEditMode: relativeVolumeEditMode,
            onPointerEvent,
          });
          pointerInput = mountedPointerInput;
          return () => h("div", { ref: mountedPointerInput.canvasContainer });
        },
      }),
    );

    if (pointerInput == undefined) {
      throw new Error("pointerInput is undefined.");
    }
    vi.spyOn(wrapper.element, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 500, 100),
    );

    const pointerEvent = new PointerEvent("pointerdown", {
      button: 0,
      clientX: 100,
      clientY: 50,
    });
    pointerInput.onSurfacePointerDown(pointerEvent);

    expect(onPointerEvent).toHaveBeenCalledWith({
      pointerEvent,
      targetArea: "VolumeEditorArea",
      pointerInfo: {
        position: {
          frame: 20,
          value: 0,
        },
        db: 0,
        x: 100,
        y: 50,
      },
    });
    wrapper.unmount();
  });
});
