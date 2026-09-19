import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Presentation from "@/components/Song/SequencerVolumeEditor/Presentation.vue";
import { VolumeEditorRenderer } from "@/components/Song/SequencerVolumeEditor/renderer";
import { relativeVolumeEditMode } from "@/song/volumeEditMode";
import { Color } from "@/song/graphics/lineStrip";
import { NoteId } from "@/type/preload";

vi.mock("@/song/graphics/cssColor", () => ({
  createThemeColorResolver: (variables: Record<string, string>) => () =>
    Object.fromEntries(
      Object.keys(variables).map((key) => [key, new Color(0, 0, 0, 255)]),
    ),
}));

const mountEditor = () =>
  mount(Presentation, {
    props: {
      viewportInfo: { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 },
      effectiveFramewise: [null, null, 6, 6, 0, 0, null, null, 0, 0],
      editableFrameRanges: [
        { startFrame: 2, endFrame: 6 },
        { startFrame: 8, endFrame: 10 },
      ],
      notes: [
        {
          id: NoteId("short"),
          position: 80,
          duration: 60,
          noteNumber: 60,
          lyric: "短",
        },
        {
          id: NoteId("long"),
          position: 140,
          duration: 120,
          noteNumber: 62,
          lyric: "長",
        },
      ],
      previewEraseRanges: [],
      tempos: [{ position: 0, bpm: 120 }],
      tpqn: 480,
      editorFrameRate: 24,
      previewMode: "IDLE",
      cursorState: "DRAW",
      tooltipData: undefined,
      highlightedFrame: 2,
      highlightedEditableRange: { startFrame: 2, endFrame: 6 },
      tool: "DRAW",
      isDark: false,
      uiLocked: false,
      volumeEditMode: relativeVolumeEditMode,
    },
    global: { stubs: { ContextMenu: true, SequencerVolumeToolPalette: true } },
  });

describe("ボリュームレーンの表示", () => {
  beforeEach(() => {
    vi.spyOn(VolumeEditorRenderer, "create").mockResolvedValue(undefined);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(500);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(160);
  });

  afterEach(() => vi.restoreAllMocks());

  it("ホバーではカーブ上の点と縦ガイド、描画中はプレビュー値と縦横ガイドを表示する", async () => {
    const wrapper = mountEditor();
    try {
      await flushPromises();
      await wrapper.setProps({
        tooltipData: { db: 6, pointerX: 73, pointerY: 120 },
      });
      expect(wrapper.get(".volume-value-tooltip").text()).toBe("+6.0 dB");
      expect(wrapper.get(".volume-hover-point").attributes("cx")).toBe("68");
      expect(wrapper.get(".volume-hover-point").attributes("cy")).toBe("40");
      expect(wrapper.get(".volume-vertical-guide").attributes("x1")).toBe("68");
      expect(wrapper.get(".volume-vertical-guide").attributes("y2")).toBe(
        "36.5",
      );
      expect(wrapper.find(".volume-value-guide-line").exists()).toBe(false);

      await wrapper.setProps({ tool: "ERASE", cursorState: "ERASE" });
      expect(wrapper.find(".volume-hover-point").exists()).toBe(false);
      expect(wrapper.get(".volume-vertical-guide").attributes("y2")).toBe("40");
      expect(wrapper.findAll(".volume-lane-note.active")).toHaveLength(0);
      await wrapper.setProps({ tool: "DRAW", cursorState: "DRAW" });

      await wrapper.setProps({
        previewMode: "VOLUME_DRAW",
        tooltipData: { db: -6, pointerX: 110, pointerY: 120 },
      });
      expect(wrapper.get(".volume-value-tooltip").text()).toBe("-6.0 dB");
      expect(wrapper.find(".volume-hover-point").exists()).toBe(false);
      expect(wrapper.get(".volume-vertical-guide").attributes("x1")).toBe(
        "110",
      );
      expect(wrapper.get(".volume-vertical-guide").attributes("y2")).toBe(
        "120",
      );
      expect(
        wrapper.get(".volume-value-guide-line").attributes("style"),
      ).toContain("top: 120px");
      expect(wrapper.findAll(".volume-lane-note.active")).toHaveLength(1);

      await wrapper.setProps({
        tooltipData: { db: 10.5, pointerX: 120, pointerY: 10 },
      });
      expect(wrapper.get(".volume-vertical-guide").attributes("y2")).toBe("24");

      await wrapper.setProps({
        previewMode: "IDLE",
        tooltipData: undefined,
        highlightedFrame: undefined,
        highlightedEditableRange: undefined,
      });
      expect(wrapper.find(".volume-value-tooltip").exists()).toBe(false);
      expect(wrapper.find(".volume-vertical-guide").exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("短いノートの歌詞と画面外の端点ラベルを省く", async () => {
    const wrapper = mountEditor();
    try {
      await flushPromises();
      expect(
        wrapper.findAll(".volume-lane-note span").map((span) => span.text()),
      ).toEqual(["長"]);
      expect(wrapper.findAll(".volume-lane-note-tick")).toHaveLength(2);
      expect(
        wrapper.findAll(".volume-endpoint-label").map((label) => label.text()),
      ).toEqual(["+6.0 dB"]);

      await wrapper.setProps({
        viewportInfo: { scaleX: 1, scaleY: 1, offsetX: 30, offsetY: 0 },
      });
      expect(wrapper.find(".volume-endpoint-label").exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("0dB線と目盛りを表示スケールの同じ位置に置く", async () => {
    const wrapper = mountEditor();
    try {
      await wrapper.setProps({
        volumeEditMode: {
          ...relativeVolumeEditMode,
          valueScale: {
            ...relativeVolumeEditMode.valueScale,
            minDb: -24,
            dbToNormalizedY: (db) => (db + 24) / 36,
            normalizedYToDb: (y) => y * 36 - 24,
          },
        },
      });
      const line = wrapper.get(".volume-zero-line line");
      expect(Number(line.attributes("y1")?.replace("%", ""))).toBeCloseTo(
        100 / 3,
      );
      expect(line.attributes("y2")).toBe(line.attributes("y1"));
      expect(wrapper.get(".volume-grid-label").attributes("style")).toContain(
        `top: ${line.attributes("y1")}`,
      );
    } finally {
      wrapper.unmount();
    }
  });
});
