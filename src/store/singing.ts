import { Score, SingingStoreState, SingingStoreTypes } from "./type";
import { createPartialStore } from "./vuex";

export const singingStoreState: SingingStoreState = {
  engineId: undefined,
  styleId: undefined,
  score: undefined,
  renderPhrases: [],
  // NOTE: UIの状態は試行のためsinging.tsに局所化する+Hydrateが必要
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

  SET_SINGER: {
    mutation(
      state,
      { engineId, styleId }: { engineId: string; styleId: number }
    ) {
      state.engineId = engineId;
      state.styleId = styleId;
    },
    async action(
      { state, getters, dispatch, commit },
      payload: { engineId?: string; styleId?: number }
    ) {
      if (state.defaultStyleIds == undefined)
        throw new Error("state.defaultStyleIds == undefined");
      if (getters.USER_ORDERED_CHARACTER_INFOS == undefined)
        throw new Error("state.characterInfos == undefined");
      const userOrderedCharacterInfos = getters.USER_ORDERED_CHARACTER_INFOS;

      const engineId = payload.engineId ?? state.engineIds[0];

      // FIXME: engineIdも含めて探査する
      const styleId =
        payload.styleId ??
        state.defaultStyleIds[
          state.defaultStyleIds.findIndex(
            (x) =>
              x.speakerUuid === userOrderedCharacterInfos[0].metas.speakerUuid // FIXME: defaultStyleIds内にspeakerUuidがない場合がある
          )
        ].defaultStyleId;

      try {
        // 指定されたstyleIdに対して、エンジン側の初期化を行う
        const isInitialized = await dispatch("IS_INITIALIZED_ENGINE_SPEAKER", {
          engineId,
          styleId,
        });
        if (!isInitialized) {
          await dispatch("INITIALIZE_ENGINE_SPEAKER", {
            engineId,
            styleId,
          });
        }
      } finally {
        commit("SET_SINGER", { engineId, styleId });
      }
    },
  },

  GET_DEFAULT_SCORE: {
    async action() {
      const score: Score = {
        resolution: 480,
        // テンポの初期値は120で良いでしょうか？
        tempos: [{ position: 0, tempo: 120 }],
        timeSignatures: [{ position: 0, beats: 4, beatType: 4 }],
        notes: [],
      };
      return score;
    },
  },

  SET_SCORE: {
    mutation(state, { score }: { score: Score }) {
      state.score = score;
    },
    async action({ commit }, { score }: { score: Score }) {
      commit("SET_SCORE", { score });
    },
  },
});
