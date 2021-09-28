import { Action } from "vuex";
import { StoreOptions } from "./vuex";

import { enablePatches, enableMapSet, Patch, Draft, Immer } from "immer";
import { applyPatch, Operation } from "rfc6902";
import {
  State,
  Command,
  CommandGetters,
  CommandActions,
  CommandMutations,
} from "./type";
import { Mutation, MutationsBase, MutationTree } from "@/store/vuex";

enablePatches();
enableMapSet();

const immer = new Immer();
immer.setAutoFreeze(false);

export const CAN_UNDO = "CAN_UNDO";
export const CAN_REDO = "CAN_REDO";

/**
 * @deprecated Action中でのCommandの作成はバグを含むので非推奨になっています。
 * 代わりに`createCommandMutationTree`, `createCommandMutation`を使用して下さい。
 * */
export const OLD_PUSH_COMMAND = "OLD_PUSH_COMMAND";
export const UNDO = "UNDO";
export const REDO = "REDO";
export const CLEAR_COMMANDS = "CLEAR_COMMANDS";

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
    commit(OLD_PUSH_COMMAND, { command: commandFactory(state, payload) });
  };
}

export type PayloadRecipe<S, P> = (draft: Draft<S>, payload: P) => void;
export type PayloadRecipeTree<S, M> = {
  [K in keyof M]: PayloadRecipe<S, M[K]>;
};
export type PayloadMutation<S, P extends Record<string, unknown> | undefined> =
  (state: S, payload: P) => void;
export type PayloadMutationTree<S> = Record<string, PayloadMutation<S, any>>;

interface UndoRedoState {
  undoCommands: Command[];
  redoCommands: Command[];
}

/**
 * レシピをプロパティに持つオブジェクトから操作を記録するMutationをプロパティにもつオブジェクトを返す関数
 * @see {@link recordOperations} - 返されるMutationはStateのスナップショットを撮ります.
 * これはパフォーマンス上のボトルネックを引き起こし得ます。
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
 * @see {@link recordOperations} - 返されるMutationはStateのスナップショットを撮ります.
 * これはパフォーマンス上のボトルネックを引き起こし得ます。
 * @param payloadRecipe - 操作を記録するレシピ
 * @returns レシピと同じPayloadの型を持つMutation.
 */
export const createCommandMutation =
  <S extends UndoRedoState, M extends MutationsBase, K extends keyof M>(
    payloadRecipe: PayloadRecipe<S, M[K]>
  ): Mutation<S, M[K]> =>
  (state: S, payload: M[K]): void => {
    const command = recordOperations(payloadRecipe)(state, payload);
    applyPatch(state, command.redoOperations);
    state.undoCommands.push(command);
    state.redoCommands.splice(0);
  };

const patchToOperation = (patch: Patch): Operation => ({
  op: patch.op,
  path: `/${patch.path.join("/")}`,
  value: patch.value,
});

/**
 * この関数はStateのスナップショットを撮ります. これはパフォーマンス上のボトルネックを引き起こし得ます。
 * @param recipe - 操作を記録したいレシピ関数
 * @returns Function - レシピの操作を与えられたstateとpayloadを用いて記録したコマンドを返す関数。
 */
const recordOperations =
  <S extends UndoRedoState, M extends MutationsBase, K extends keyof M>(
    recipe: PayloadRecipe<S, M[K]>
  ) =>
  (state: S, payload: M[K]): Command => {
    const [_, doPatches, undoPatches] = immer.produceWithPatches(
      // Taking snapshots has negative effects on performance.
      // This approach may cause a bottleneck.
      JSON.parse(JSON.stringify(state)) as State,
      (draft: Draft<S>) => recipe(draft, payload)
    );
    return {
      redoOperations: doPatches.map(patchToOperation),
      undoOperations: undoPatches.map(patchToOperation),
    };
  };

export const commandStore: StoreOptions<
  State,
  CommandGetters,
  CommandActions,
  CommandMutations
> = {
  getters: {
    [CAN_UNDO](state) {
      return state.undoCommands.length > 0;
    },
    [CAN_REDO](state) {
      return state.redoCommands.length > 0;
    },
  },

  mutations: {
    [OLD_PUSH_COMMAND](state, { command }: { command: OldCommand<State> }) {
      OldCommand.redo(state, command);
    },
    [UNDO]: (state) => {
      const command = state.undoCommands.pop();
      if (command != null) {
        state.redoCommands.push(command);
        applyPatch(state, command.undoOperations);
      }
    },
    [REDO]: (state) => {
      const command = state.redoCommands.pop();
      if (command != null) {
        state.undoCommands.push(command);
        applyPatch(state, command.redoOperations);
      }
    },
    [CLEAR_COMMANDS]: (state) => {
      state.redoCommands.splice(0);
      state.undoCommands.splice(0);
    },
  },

  actions: {
    [UNDO]: ({ commit }) => {
      commit(UNDO, undefined);
    },
    [REDO]: ({ commit }) => {
      commit(REDO, undefined);
    },
  },
};
