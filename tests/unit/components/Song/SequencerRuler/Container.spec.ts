import { mount } from "@vue/test-utils";
import { computed } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Container from "@/components/Song/SequencerRuler/Container.vue";

// offset 30、zoom 2、offsetX 10 → baseTick 80
const OFFSET = 30;
const OFFSET_X = 10;

const { storeDouble } = vi.hoisted(() => ({
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
      DESELECT_ALL_NOTES: vi.fn(),
    },
  },
}));

vi.mock("@/store", () => ({
  useStore: () => storeDouble,
}));

vi.mock("@/composables/useSequencerLayout", () => ({
  useSequencerLayout: () => ({
    rulerWidth: computed(() => 3840),
    playheadX: computed(() => 0),
  }),
}));

describe("SequencerRuler", () => {
  beforeEach(() => {
    storeDouble.state.tpqn = 480;
    storeDouble.state.sequencerSnapType = 16;
    storeDouble.state.sequencerZoomX = 2;
    storeDouble.actions.SET_PLAYHEAD_POSITION.mockClear();
    storeDouble.actions.DESELECT_ALL_NOTES.mockClear();
  });

  const mountRuler = () =>
    mount(Container, {
      props: { offset: OFFSET },
      global: {
        stubs: {
          GridLaneContainer: true,
          ValueChangesLaneContainer: true,
          LoopLaneContainer: true,
        },
      },
    });

  const clickRuler = (wrapper: ReturnType<typeof mountRuler>) =>
    wrapper.get(".sequencer-ruler").trigger("click", { offsetX: OFFSET_X });

  it("デフォルトの1/16スナップでクリック位置を最も近い音価に丸め、ノート選択を解除する", async () => {
    const wrapper = mountRuler();

    await clickRuler(wrapper);

    // 1/16は120tick。80tickは120tickに近い
    expect(storeDouble.actions.SET_PLAYHEAD_POSITION).toHaveBeenCalledWith({
      position: 120,
    });
    expect(storeDouble.actions.DESELECT_ALL_NOTES).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("スナップ設定を粗く、または三連符に変えると再生ヘッドのグリッドが変わり、選択解除は行われる", async () => {
    const wrapper = mountRuler();

    storeDouble.state.sequencerSnapType = 4;
    await clickRuler(wrapper);
    // 1/4は480tick。80tickは0tickに近い
    expect(storeDouble.actions.SET_PLAYHEAD_POSITION).toHaveBeenLastCalledWith({
      position: 0,
    });

    storeDouble.state.sequencerSnapType = 12;
    await clickRuler(wrapper);
    // 1/8三連符は160tick。80tickは半分なので160tickへ丸まる
    expect(storeDouble.actions.SET_PLAYHEAD_POSITION).toHaveBeenLastCalledWith({
      position: 160,
    });

    expect(storeDouble.actions.DESELECT_ALL_NOTES).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});
