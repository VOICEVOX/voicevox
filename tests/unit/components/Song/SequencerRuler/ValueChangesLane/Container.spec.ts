import { mount } from "@vue/test-utils";
import { computed, defineComponent, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { offsetInjectionKey } from "@/components/Song/SequencerRuler/Container.vue";
import Container from "@/components/Song/SequencerRuler/ValueChangesLane/Container.vue";
import { numMeasuresInjectionKey } from "@/components/Song/ScoreSequencer.vue";

// offset 30、zoom 2、offsetX 10 → baseTick 80（ルーラーと同じ変換）
const OFFSET = 30;
const OFFSET_X = 10;

const ContextMenuStub = defineComponent({
  name: "ContextMenu",
  setup(_, { expose }) {
    expose({
      show: () => undefined,
      hide: () => undefined,
    });
    return () => null;
  },
});

const { storeDouble, layoutDouble } = vi.hoisted(() => ({
  storeDouble: {
    state: {
      tpqn: 480,
      sequencerSnapType: 16,
      sequencerZoomX: 2,
      timeSignatures: [{ measureNumber: 1, beats: 4, beatType: 4 }],
      tempos: [{ position: 0, bpm: 120 }],
    },
    getters: {
      PLAYHEAD_POSITION: 0,
      UI_LOCKED: false,
    },
    actions: {
      SET_PLAYHEAD_POSITION: vi.fn(),
    },
  },
  layoutDouble: {
    tsPositions: [0] as number[],
    totalTicks: 15360,
    rulerWidth: 3840,
  },
}));

vi.mock("@/store", () => ({
  useStore: () => storeDouble,
}));

vi.mock("@/composables/useSequencerLayout", () => ({
  useSequencerLayout: () => ({
    tsPositions: computed(() => layoutDouble.tsPositions),
    totalTicks: computed(() => layoutDouble.totalTicks),
    rulerWidth: computed(() => layoutDouble.rulerWidth),
  }),
}));

// happy-domではcanvasの2d contextが取れないため、表示幅計算だけ差し替える
vi.mock("@/helpers/textWidth", () => ({
  predictTextWidth: () => 1,
}));

describe("ValueChangesLane", () => {
  beforeEach(() => {
    storeDouble.state.tpqn = 480;
    storeDouble.state.sequencerSnapType = 16;
    storeDouble.state.sequencerZoomX = 2;
    storeDouble.state.timeSignatures = [
      { measureNumber: 1, beats: 4, beatType: 4 },
    ];
    storeDouble.state.tempos = [{ position: 0, bpm: 120 }];
    storeDouble.getters.UI_LOCKED = false;
    storeDouble.getters.PLAYHEAD_POSITION = 0;
    layoutDouble.tsPositions = [0];
    storeDouble.actions.SET_PLAYHEAD_POSITION.mockClear();
  });

  const mountLane = () =>
    mount(Container, {
      global: {
        stubs: { ContextMenu: ContextMenuStub },
        provide: {
          [offsetInjectionKey]: ref(OFFSET),
          [numMeasuresInjectionKey]: { numMeasures: computed(() => 32) },
        },
      },
    });

  const clickEmpty = (wrapper: ReturnType<typeof mountLane>) =>
    wrapper
      .get(".lane-background")
      .trigger("contextmenu", { offsetX: OFFSET_X });

  const clickMarker = (wrapper: ReturnType<typeof mountLane>, text: string) => {
    const marker = wrapper
      .findAll(".value-changes-lane-value-change")
      .find((node) => node.text() === text);
    if (marker == undefined) {
      throw new Error(`marker ${text} was not rendered`);
    }
    return marker.trigger("click", { offsetX: OFFSET_X });
  };

  it("空き部分のクリックはルーラーと同じスナップ幅と座標変換で再生ヘッドを移動する", async () => {
    const wrapper = mountLane();

    await clickEmpty(wrapper);
    // 1/16は120tick。80tickは120tickに近い
    expect(storeDouble.actions.SET_PLAYHEAD_POSITION).toHaveBeenCalledWith({
      position: 120,
    });

    storeDouble.state.sequencerSnapType = 4;
    await clickEmpty(wrapper);
    // 1/4は480tick。80tickは0tickに近い
    expect(storeDouble.actions.SET_PLAYHEAD_POSITION).toHaveBeenLastCalledWith({
      position: 0,
    });

    storeDouble.state.sequencerSnapType = 12;
    await clickEmpty(wrapper);
    // 1/8三連符は160tick。80tickは半分なので160tickへ丸まる
    expect(storeDouble.actions.SET_PLAYHEAD_POSITION).toHaveBeenLastCalledWith({
      position: 160,
    });

    wrapper.unmount();
  });

  it("テンポまたは拍子の変更位置はそのまま再生ヘッドにする", async () => {
    storeDouble.state.tempos = [
      { position: 0, bpm: 120 },
      { position: 100, bpm: 140 },
    ];
    storeDouble.state.timeSignatures = [
      { measureNumber: 1, beats: 4, beatType: 4 },
      { measureNumber: 2, beats: 3, beatType: 4 },
    ];
    layoutDouble.tsPositions = [0, 250];
    const wrapper = mountLane();

    await clickMarker(wrapper, "140");
    expect(storeDouble.actions.SET_PLAYHEAD_POSITION).toHaveBeenLastCalledWith({
      position: 100,
    });

    await clickMarker(wrapper, "3/4");
    expect(storeDouble.actions.SET_PLAYHEAD_POSITION).toHaveBeenLastCalledWith({
      position: 250,
    });

    wrapper.unmount();
  });

  it("UIロック中は再生ヘッドを移動しない", async () => {
    storeDouble.getters.UI_LOCKED = true;
    storeDouble.state.sequencerSnapType = 4;
    storeDouble.state.tempos = [
      { position: 0, bpm: 120 },
      { position: 100, bpm: 140 },
    ];
    layoutDouble.tsPositions = [0, 250];
    storeDouble.state.timeSignatures = [
      { measureNumber: 1, beats: 4, beatType: 4 },
      { measureNumber: 2, beats: 3, beatType: 4 },
    ];
    const wrapper = mountLane();

    await clickEmpty(wrapper);
    await clickMarker(wrapper, "140");
    await clickMarker(wrapper, "3/4");

    expect(storeDouble.actions.SET_PLAYHEAD_POSITION).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
