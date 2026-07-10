import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  useVolumeEditorInteraction,
  type VolumeEditorPointerEvent,
} from "@/components/Sing/SequencerVolumeEditor/useInteraction";
import { currentVolumeEditMode } from "@/sing/volumeEditMode";
import type { VolumeEditorPreviewMode } from "@/sing/volumeEditorStateMachine/common";

describe("useVolumeEditorInteraction", () => {
  it("描画フィードバック範囲を保持し、現在の編集位置へ追随する", async () => {
    const previewMode = ref<VolumeEditorPreviewMode>("IDLE");
    const firstEditableRange = { startFrame: 0, endFrame: 50 };
    const secondEditableRange = { startFrame: 100, endFrame: 200 };
    const onPointerEvent = vi.fn<(event: VolumeEditorPointerEvent) => void>();
    let interaction: ReturnType<typeof useVolumeEditorInteraction> | undefined;

    const wrapper = mount(
      defineComponent({
        setup() {
          const mountedInteraction = useVolumeEditorInteraction({
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
            editableFrameRanges: ref([firstEditableRange, secondEditableRange]),
            volumeEditMode: currentVolumeEditMode,
            onPointerEvent,
            onRenderRequested: vi.fn(),
          });
          interaction = mountedInteraction;
          return () => h("div", { ref: mountedInteraction.canvasContainer });
        },
      }),
    );

    if (interaction == undefined) {
      throw new Error("interaction is undefined.");
    }
    vi.spyOn(wrapper.element, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 500, 100),
    );

    interaction.onSurfacePointerDown(
      new PointerEvent("pointerdown", {
        button: 0,
        clientX: 100,
        clientY: 50,
      }),
    );

    // Containerからのprops更新はpointerdownの処理後に反映される。
    previewMode.value = "VOLUME_DRAW";
    await nextTick();

    expect(interaction.feedbackRange.value).toEqual(firstEditableRange);

    window.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 400,
        clientY: 50,
      }),
    );

    expect(interaction.feedbackRange.value).toEqual(secondEditableRange);
    wrapper.unmount();
  });
});
