import { SingingStoreState, SingingStoreTypes } from "./type";
import { useStore } from "@/store";
import { createPartialStore } from "./vuex";

export const singingStoreState: SingingStoreState = {
  engineId: undefined,
  styleId: undefined,
  score: undefined,
  renderPhrases: [],
  // NOTE: UIの状態などはHydrateもあり分割した方がよさそう(そもそもキャラクターを使った方が)、試行のためsinging.tsに局所化する
  isShowSinger: true,
};

export const singingStore = createPartialStore<SingingStoreTypes>({
  SET_SHOW_SINGER: {
    mutation(state, { isShowSinger }: { isShowSinger: boolean }) {
      state.isShowSinger = isShowSinger;
    },
    async action({ commit }, { isShowSinger }) {
      commit("SET_SHOW_SINGER", {
        isShowSinger,
      });
    },
  },
});
