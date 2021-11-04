import { toRaw } from "vue";
import { enablePatches, enableMapSet, Immer } from "immer";
// immerの内部関数であるgetPlugin("Patches").applyPatches_はexportされていないので
// ビルド前のsrcからソースコードを読み込んで使う必要がある
import { enablePatches as enablePatchesImpl } from "immer/src/plugins/patches";
import { enableMapSet as enableMapSetImpl } from "immer/src/plugins/mapset";
import { getPlugin } from "immer/src/utils/plugins";

import {
  Command,
  CommandActions,
  CommandGetters,
  CommandMutations,
  CommandStoreState,
  VoiceVoxStoreOptions,
} from "./type";
import { Mutation, MutationsBase, MutationTree } from "@/store/vuex";

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

interface UndoRedoState {
  undoCommands: Command[];
  redoCommands: Command[];
}

/**
 * レシピをプロパティに持つオブジェクトから操作を記録するMutationをプロパティにもつオブジェクトを返す関数
 * @param payloadRecipeTree - レシピをプロパティに持つオブジェクト
 * @returns Mutationを持つオブジェクト(MutationTree)
 */
export const createCommandMutationTree = <
  S extends UndoRedoState,
  M extends MutationsBase
>(
  payloadRecipeTree: PayloadRecipeTree<S, M>
): MutationTree<S, M> =>
  Object.fromEntries(
    Object.entries(payloadRecipeTree).map(([key, val]) => [
      key,
      createCommandMutation(val),
    ])
  ) as MutationTree<S, M>;

/**
 * 与えられたレシピから操作を記録し実行後にStateに追加するMutationを返す。
 * @param payloadRecipe - 操作を記録するレシピ
 * @returns レシピと同じPayloadの型を持つMutation.
 */
export const createCommandMutation =
  <S extends UndoRedoState, P>(
    payloadRecipe: PayloadRecipe<S, P>
  ): Mutation<S, P> =>
  (state: S, payload: P): void => {
    const command = recordPatches(payloadRecipe)(state, payload);
    applyPatchesImpl(state, command.redoPatches);
    state.undoCommands.push(command);
    state.redoCommands.splice(0);
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
  undoCommands: [],
  redoCommands: [],
};

export const commandStore: VoiceVoxStoreOptions<
  CommandGetters,
  CommandActions,
  CommandMutations
> = {
  getters: {
    CAN_UNDO(state) {
      return state.undoCommands.length > 0;
    },
    CAN_REDO(state) {
      return state.redoCommands.length > 0;
    },
    LAST_COMMAND_UNIX_MILLISEC(state) {
      if (state.undoCommands.length === 0) {
        return null;
      } else {
        return state.undoCommands[state.undoCommands.length - 1].unixMillisec;
      }
    },
  },

  mutations: {
    UNDO(state) {
      const command = state.undoCommands.pop();
      if (command != null) {
        state.redoCommands.push(command);
        applyPatchesImpl(state, command.undoPatches);
      }
    },
    REDO(state) {
      const command = state.redoCommands.pop();
      if (command != null) {
        state.undoCommands.push(command);
        applyPatchesImpl(state, command.redoPatches);
      }
    },
    CLEAR_COMMANDS(state) {
      state.redoCommands.splice(0);
      state.undoCommands.splice(0);
    },
  },

  actions: {
    UNDO({ commit }) {
      commit("UNDO");
    },
    REDO({ commit }) {
      commit("REDO");
    },
  },
};
