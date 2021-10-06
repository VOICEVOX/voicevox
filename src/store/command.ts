import { Action, Store } from "vuex";
import { toRaw } from "vue";
import { enablePatches, enableMapSet, Patch, Draft, Immer } from "immer";
import { applyPatch, Operation } from "rfc6902";
import {
  State,
  Command,
  CommandGetters,
  CommandActions,
  CommandMutations,
  AllMutations,
  VoiceVoxStoreOptions,
} from "./type";
import { Mutation, MutationsBase, MutationTree } from "@/store/vuex";

enablePatches();
enableMapSet();

const immer = new Immer();
immer.setAutoFreeze(false);

/**
 * @deprecated Action中でのCommandの作成はバグを含むので非推奨になっています。
 * 代わりに`createCommandMutationTree`, `createCommandMutation`を使用して下さい。
 * */
export class OldCommand<S> {
  undoOperations: Operation[];
  redoOperations: Operation[];

  constructor(state: S, recipe: (draft: Draft<S>) => void) {
    const [_, redoPatches, undoPatches] = immer.produceWithPatches(
      state,
      recipe
    );
    this.undoOperations = OldCommand.convertPatches(undoPatches);
    this.redoOperations = OldCommand.convertPatches(redoPatches);
  }

  static redo<S>(state: S, command: OldCommand<S>) {
    applyPatch(state, command.redoOperations);
  }
  static undo<S>(state: S, command: OldCommand<S>) {
    applyPatch(state, command.undoOperations);
  }

  static convertPatches(patches: Patch[]) {
    return patches.map((patch) => {
      const operation: Operation = {
        op: patch.op,
        path: `/${patch.path.join("/")}`,
        value: patch.value,
      };
      return operation;
    });
  }
}

/**
 * @deprecated Action中でのCommandの作成はバグを含むので非推奨になっています。
 * 代わりに`createCommandMutationTree`, `createCommandMutation`を使用して下さい。
 * */
type OldCommandFactory<S, P> = (state: S, payload: P) => OldCommand<S>;

/**
 * @deprecated Action中でのCommandの作成はバグを含むので非推奨になっています。
 * 代わりに`createCommandMutationTree`, `createCommandMutation`を使用して下さい。
 * */
const oldCreateCommandFactory =
  <S, P>(
    recipeWithPayload: (draft: Draft<S>, payload: P) => void
  ): OldCommandFactory<S, P> =>
  (state, payload) =>
    new OldCommand(state, (draft) => recipeWithPayload(draft, payload));

/**
 * @deprecated Action中でのCommandの作成はバグを含むので非推奨になっています。
 * 代わりに`createCommandMutationTree`, `createCommandMutation`を使用して下さい。
 * */
export function oldCreateCommandAction<S, P>(
  recipeWithPayload: (draft: Draft<S>, payload: P) => void
): Action<S, S> {
  const commandFactory = oldCreateCommandFactory(recipeWithPayload);
  return ({ state, commit }, payload: P) => {
    commit("OLD_PUSH_COMMAND", { command: commandFactory(state, payload) });
  };
}

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
      createCommandMutation(key, val),
    ])
  ) as MutationTree<S, M>;

/**
 * 与えられたレシピから操作を記録し実行後にStateに追加するMutationを返す。
 * @param payloadRecipe - 操作を記録するレシピ
 * @returns レシピと同じPayloadの型を持つMutation.
 */
export const createCommandMutation =
  <S extends UndoRedoState, P extends AllMutations[keyof AllMutations]>(
    key: string,
    payloadRecipe: PayloadRecipe<S, P>
  ): Mutation<S, P> =>
  (state: S, payload: P): void => {
    if (state.useUndoRedo) {
      const command = recordOperations(key, payloadRecipe)(state, payload);
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
  <S, P extends AllMutations[keyof AllMutations]>(
    key: string,
    recipe: PayloadRecipe<S, P>
  ) =>
  (state: S, payload: P): Command => {
    const [_, doPatches, undoPatches] = immer.produceWithPatches(
      toRaw(state) as S,
      (draft: S) => recipe(draft, payload)
    );
    return {
      name: key,
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
    HISTORY(state) {
      return state.undoCommands.map(({ name, unixMillisec }) => ({
        name,
        unixMillisec,
      }));
    },
  },

  mutations: {
    OLD_PUSH_COMMAND(state, { command }: { command: OldCommand<State> }) {
      OldCommand.redo(state, command);
    },
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
