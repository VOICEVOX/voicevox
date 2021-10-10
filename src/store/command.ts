import { toRaw } from "vue";
import { enablePatches, enableMapSet, Patch, Immer } from "immer";
import { applyPatch, Operation } from "rfc6902";
import {
  Command,
  CommandGetters,
  CommandActions,
  CommandMutations,
  VoiceVoxStoreOptions,
} from "./type";
import { Mutation, MutationsBase, MutationTree } from "@/store/vuex";

enablePatches();
enableMapSet();

const immer = new Immer();
immer.setAutoFreeze(false);

export type PayloadRecipe<S, P> = (draft: S, payload: P) => void;
export type PayloadRecipeTree<S, M> = {
  [K in keyof M]: PayloadRecipe<S, M[K]>;
};
export type PayloadMutation<S, P extends Record<string, unknown> | undefined> =
  (state: S, payload: P) => void;
export type PayloadMutationTree<S> = Record<string, PayloadMutation<S, any>>;

interface UndoRedoState {
  undoCommands: Command[];
  redoCommands: Command[];
  useUndoRedo: boolean;
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
    if (state.useUndoRedo) {
      const command = recordOperations(payloadRecipe)(state, payload);
      applyPatch(state, command.redoOperations);
      state.undoCommands.push(command);
      state.redoCommands.splice(0);
    } else {
      payloadRecipe(state, payload);
    }
  };

const patchToOperation = (patch: Patch): Operation => ({
  op: patch.op,
  path: `/${patch.path.join("/")}`,
  value: patch.value,
});

/**
 * @param recipe - 操作を記録したいレシピ関数
 * @returns Function - レシピの操作を与えられたstateとpayloadを用いて記録したコマンドを返す関数。
 */
const recordOperations =
  <S, P>(recipe: PayloadRecipe<S, P>) =>
  (state: S, payload: P): Command => {
    const [_, doPatches, undoPatches] = immer.produceWithPatches(
      toRaw(state) as S,
      (draft: S) => recipe(draft, payload)
    );
    return {
      unixMillisec: new Date().getTime(),
      redoOperations: doPatches.map(patchToOperation),
      undoOperations: undoPatches.map(patchToOperation),
    };
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
        applyPatch(state, command.undoOperations);
      }
    },
    REDO(state) {
      const command = state.redoCommands.pop();
      if (command != null) {
        state.undoCommands.push(command);
        applyPatch(state, command.redoOperations);
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
