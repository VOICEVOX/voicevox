import { toRaw } from "vue";
import { enablePatches, enableMapSet, Immer } from "immer";
// immerの内部関数であるgetPlugin("Patches").applyPatches_はexportされていないので
// ビルド前のsrcからソースコードを読み込んで使う必要がある
import { enablePatches as enablePatchesImpl } from "immer/src/plugins/patches";
import { enableMapSet as enableMapSetImpl } from "immer/src/plugins/mapset";
import { getPlugin } from "immer/src/utils/plugins";

import { Command, CommandStoreState, CommandStoreTypes, State } from "./type";
import {
  createPartialStore,
  Mutation,
  MutationsBase,
  MutationTree,
} from "@/store/vuex";
import { EditorType } from "@/type/preload";

// ビルド後のモジュールとビルド前のモジュールは別のスコープで変数を持っているので
// enable * も両方叩く必要がある。
enablePatches();
enableMapSet();
enablePatchesImpl();
enableMapSetImpl();
// immerのPatchをmutableに適応する内部関数
const applyPatchesImpl = getPlugin("Patches").applyPatches_;

const immer = new Immer();
immer.setAutoFreeze(false);

export type PayloadRecipe<S, P> = (draft: S, payload: P) => void;
export type PayloadRecipeTree<S, M> = {
  [K in keyof M]: PayloadRecipe<S, M[K]>;
};

/**
 * レシピをプロパティに持つオブジェクトから操作を記録するMutationをプロパティにもつオブジェクトを返す関数
 * @param payloadRecipeTree - レシピをプロパティに持つオブジェクト
 * @returns Mutationを持つオブジェクト(MutationTree)
 */
export const createCommandMutationTree = <S, M extends MutationsBase>(
  payloadRecipeTree: PayloadRecipeTree<S, M>,
  editor: EditorType
): MutationTree<S, M> =>
  Object.fromEntries(
    Object.entries(payloadRecipeTree).map(([key, val]) => [
      key,
      createCommandMutation(val, editor),
    ])
  ) as MutationTree<S, M>;

/**
 * 与えられたレシピから操作を記録し実行後にStateに追加するMutationを返す。
 * @param payloadRecipe - 操作を記録するレシピ
 * @returns レシピと同じPayloadの型を持つMutation.
 */
export const createCommandMutation =
  <S extends State, M extends MutationsBase, K extends keyof M>(
    payloadRecipe: PayloadRecipe<S, M[K]>,
    editor: EditorType
  ): Mutation<S, M, K> =>
  (state: S, payload: M[K]): void => {
    const command = recordPatches(payloadRecipe)(state, payload);
    applyPatchesImpl(state, command.redoPatches);
    state.undoCommands[editor].push(command);
    state.redoCommands[editor].splice(0);
  };

/**
 * @param recipe - 操作を記録したいレシピ関数
 * @returns Function - レシピの操作を与えられたstateとpayloadを用いて記録したコマンドを返す関数。
 */
const recordPatches =
  <S, P>(recipe: PayloadRecipe<S, P>) =>
  (state: S, payload: P): Command => {
    const [, doPatches, undoPatches] = immer.produceWithPatches(
      toRaw(state) as S,
      (draft: S) => recipe(draft, payload)
    );
    return {
      unixMillisec: new Date().getTime(),
      redoPatches: doPatches,
      undoPatches: undoPatches,
    };
  };

export const commandStoreState: CommandStoreState = {
  undoCommands: {
    talk: [],
    song: [],
  },
  redoCommands: {
    talk: [],
    song: [],
  },
};

export const commandStore = createPartialStore<CommandStoreTypes>({
  CAN_UNDO: {
    getter: (state) => (editor: EditorType) => {
      return state.undoCommands[editor].length > 0;
    },
  },

  CAN_REDO: {
    getter: (state) => (editor: EditorType) => {
      return state.redoCommands[editor].length > 0;
    },
  },

  UNDO: {
    mutation(state, { editor }) {
      const command = state.undoCommands[editor].pop();
      if (command != null) {
        state.redoCommands[editor].push(command);
        applyPatchesImpl(state, command.undoPatches);
      }
    },
    action({ commit, dispatch }, { editor }: { editor: EditorType }) {
      commit("UNDO", { editor });
      if (editor === "song") {
        dispatch("RENDER");
      }
    },
  },

  REDO: {
    mutation(state, { editor }) {
      const command = state.redoCommands[editor].pop();
      if (command != null) {
        state.undoCommands[editor].push(command);
        applyPatchesImpl(state, command.redoPatches);
      }
    },
    action({ commit, dispatch }, { editor }: { editor: EditorType }) {
      commit("REDO", { editor });
      if (editor === "song") {
        dispatch("RENDER");
      }
    },
  },

  LAST_COMMAND_UNIX_MILLISEC: {
    getter(state) {
      let lastCommandTime: number | null = null;
      let lastSongCommandTime: number | null = null;
      if (state.undoCommands["talk"].length !== 0) {
        lastCommandTime =
          state.undoCommands["talk"][state.undoCommands["talk"].length - 1]
            .unixMillisec;
      }
      if (state.undoCommands["song"].length !== 0) {
        lastSongCommandTime =
          state.undoCommands["song"][state.undoCommands["song"].length - 1]
            .unixMillisec;
      }
      if (lastCommandTime != null && lastSongCommandTime != null) {
        return Math.max(lastCommandTime, lastSongCommandTime);
      } else if (lastCommandTime != null) {
        return lastCommandTime;
      } else if (lastSongCommandTime != null) {
        return lastSongCommandTime;
      }
      return null;
    },
  },

  CLEAR_COMMANDS: {
    mutation(state) {
      for (const editor of ["talk", "song"] as const) {
        state.undoCommands[editor].splice(0);
        state.redoCommands[editor].splice(0);
      }
    },
  },
});
