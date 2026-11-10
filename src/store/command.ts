import { toRaw, type DeepReadonly } from "vue";
import { enablePatches, enableMapSet, Immer } from "immer";

import type {
  AllMutations,
  Command,
  CommandMutationName,
  CommandStoreState,
  CommandStoreTypes,
  State,
} from "./type";
import { applyPatches } from "@/store/immerPatchUtility";
import {
  createPartialStore,
  type DotNotationCommit,
  type Mutation,
  type MutationsBase,
  type MutationTree,
} from "@/store/vuex";
import { CommandId, type EditorType } from "@/type/preload";
import { uuid4 } from "@/helpers/random";
import { objectEntries, objectFromEntries } from "@/helpers/typedEntries";

enablePatches();
enableMapSet();

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
  editor: EditorType,
): MutationTree<S, M> =>
  objectFromEntries(
    objectEntries(payloadRecipeTree).map(([key, val]) => [
      key,
      // @ts-expect-error とりあえず動くので無視
      createCommandMutation(val, editor),
    ]),
  ) as MutationTree<S, M>;

/**
 * 与えられたレシピから操作を記録し実行後にStateに追加するMutationを返す。
 * @param payloadRecipe - 操作を記録するレシピ
 * @returns レシピと同じPayloadの型を持つMutation.
 */
export const createCommandMutation =
  <S extends State, M extends MutationsBase, K extends keyof M>(
    payloadRecipe: PayloadRecipe<S, M[K]>,
    editor: EditorType,
  ): Mutation<S, M, K> =>
  (state: S, payload: M[K]): void => {
    const command = recordPatches(payloadRecipe)(state, payload);
    applyPatches(state, command.redoPatches);
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
      toRaw(state),
      (draft: S) => recipe(draft, payload),
    );
    return {
      id: CommandId(uuid4()),
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

/**
 * Undo/Redoのパッチ適用の後に実行されるHookの型。
 *
 * Hookの引数のmutationsからは、Undo/Redoの履歴を変更するmutationを除外している。
 *
 * パッチは、配列の番号やオブジェクトのキーで変更先を指定している。
 * そのため、パッチが変更する配列やオブジェクトの要素を、Hook内で増減したり並び替えたりしてしまうと、以降のUndo/Redoが正しく動作しなくなる。
 * この制約は型で保証されていない。
 */
export type AfterUndoRedoHook = (context: {
  afterState: DeepReadonly<State>;
  mutations: Omit<
    DotNotationCommit<AllMutations>,
    CommandMutationName | keyof CommandStoreTypes
  >;
}) => void;

/**
 * Undo/Redoのパッチ適用の後に実行されるHookを作成する関数の型。
 *
 * 関数はパッチ適用前に呼ばれ、関数が返すHookはパッチ適用後に実行される。
 * パッチはstateをその場で書き換えるため、パッチ適用前の値は、関数の中でコピーしておく必要がある。
 */
export type AfterUndoRedoHookFactory = (
  beforeState: DeepReadonly<State>,
) => AfterUndoRedoHook;

export const createCommandStore = (
  afterUndoRedoHookFactories: Record<EditorType, AfterUndoRedoHookFactory[]>,
) =>
  createPartialStore<CommandStoreTypes>({
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
          applyPatches(state, command.undoPatches);
        }
      },
      action({ state, mutations }, { editor }: { editor: EditorType }) {
        const afterUndoRedoHooks = afterUndoRedoHookFactories[editor].map(
          (factory) => factory(state),
        );
        mutations.UNDO({ editor });
        for (const afterUndoRedoHook of afterUndoRedoHooks) {
          afterUndoRedoHook({ afterState: state, mutations });
        }
      },
    },

    REDO: {
      mutation(state, { editor }) {
        const command = state.redoCommands[editor].pop();
        if (command != null) {
          state.undoCommands[editor].push(command);
          applyPatches(state, command.redoPatches);
        }
      },
      action({ state, mutations }, { editor }: { editor: EditorType }) {
        const afterUndoRedoHooks = afterUndoRedoHookFactories[editor].map(
          (factory) => factory(state),
        );
        mutations.REDO({ editor });
        for (const afterUndoRedoHook of afterUndoRedoHooks) {
          afterUndoRedoHook({ afterState: state, mutations });
        }
      },
    },

    LAST_COMMAND_IDS: {
      getter(state) {
        const getLastCommandId = (commands: Command[]): CommandId | null => {
          if (commands.length == 0) return null;
          else return commands[commands.length - 1].id;
        };

        return {
          talk: getLastCommandId(state.undoCommands["talk"]),
          song: getLastCommandId(state.undoCommands["song"]),
        };
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
