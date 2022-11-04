import { Score, SingingStoreState, SingingStoreTypes } from "./type";
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import { Midi } from "@tonejs/midi";

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

  IMPORT_MIDI_FILE: {
    action: createUILockAction(
      async ({ dispatch }, { filePath }: { filePath?: string }) => {
        if (!filePath) {
          filePath = await window.electron.showImportFileDialog({
            title: "MIDI読み込み",
            name: "MIDI",
            extensions: ["mid", "midi"],
          });
          if (!filePath) return;
        }

        const midiData = await window.electron.readFile({ filePath });
        const midi = new Midi(midiData);

        const score = await dispatch("GET_DEFAULT_SCORE");

        const ConvertToPosBasedOnRes = (position: number) => {
          return Math.round(position * (score.resolution / midi.header.ppq));
        };

        const ConvertToDurationBasedOnRes = (
          position: number,
          duration: number
        ) => {
          let endPosition = position + duration;
          endPosition = ConvertToPosBasedOnRes(endPosition);
          position = ConvertToPosBasedOnRes(position);
          return Math.max(0, endPosition - position);
        };

        score.notes = midi.tracks
          .map((track, index) => {
            // TODO: UIで読み込むトラックを選択できるようにする
            if (index !== 0) return []; // ひとまず1トラック目のみを読み込む
            return track.notes.map((note) => ({
              position: ConvertToPosBasedOnRes(note.ticks),
              duration: ConvertToDurationBasedOnRes(
                note.ticks,
                note.durationTicks
              ),
              midi: note.midi,
              lyric: "",
            }));
          })
          .flat()
          .sort((a, b) => a.position - b.position);

        if (midi.header.tempos.length !== 0) {
          score.tempos = midi.header.tempos
            .map((tempo) => ({
              position: tempo.ticks,
              tempo: tempo.bpm,
            }))
            .sort((a, b) => a.position - b.position);
        }

        if (midi.header.timeSignatures.length !== 0) {
          score.timeSignatures = midi.header.timeSignatures
            .map((timeSignature) => ({
              position: timeSignature.ticks,
              beats: timeSignature.timeSignature[0],
              beatType: timeSignature.timeSignature[1],
            }))
            .sort((a, b) => a.position - b.position);
        }

        await dispatch("SET_SCORE", { score });
      }
    ),
  },
});
