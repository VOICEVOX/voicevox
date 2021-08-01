import { Action, Mutation, StoreOptions } from "vuex";

import { enablePatches, enableMapSet, Patch, Draft, Immer } from "immer";
import { applyPatch, Operation } from "rfc6902";
import { ICommand, State } from "./type";

enablePatches();
enableMapSet();

const immer = new Immer();
immer.setAutoFreeze(false);

export const CAN_UNDO = "CAN_UNDO";
export const CAN_REDO = "CAN_REDO";
export const PUSH_COMMAND = "PUSH_COMMAND";
export const UNDO = "UNDO";
export const REDO = "REDO";

export class Command<S> implements ICommand<S> {
  undoOperations: Operation[];
  redoOperations: Operation[];

  constructor(state: S, recipe: (draft: Draft<S>) => void) {
    const [_, redoPatches, undoPatches] = immer.produceWithPatches(
      state,
      recipe
    );
    this.undoOperations = Command.convertPatches(undoPatches);
    this.redoOperations = Command.convertPatches(redoPatches);
  }

  static redo<S>(state: S, command: Command<S>) {
    applyPatch(state, command.redoOperations);
  }
  static undo<S>(state: S, command: Command<S>) {
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

type CommandFactory<S, P> = (state: S, payload: P) => Command<S>;

const createCommandFactory =
  <S, P>(
    recipeWithPayload: (draft: Draft<S>, payload: P) => void
  ): CommandFactory<S, P> =>
  (state, payload) =>
    new Command(state, (draft) => recipeWithPayload(draft, payload));

export function createCommandAction<S, P>(
  recipeWithPayload: (draft: Draft<S>, payload: P) => void
): Action<S, S> {
  const commandFactory = createCommandFactory(recipeWithPayload);
  return ({ state, commit }, payload: P) => {
    commit(PUSH_COMMAND, { command: commandFactory(state, payload) });
  };
}

type UndoRedoState<S> = {
  undoCommands: Command<S>[];
  redoCommands: Command<S>[];
};
export function createCommandMutation<S extends UndoRedoState<S>, P>(
  recipeWithPayload: (draft: Draft<S>, payload: P) => void
): Mutation<S> {
  const commandFactory = createCommandFactory(recipeWithPayload);
  return (state, payload: P) => {
    const command = commandFactory(state, payload);
    Command.redo(state, command);
    state.undoCommands.push(command);
    state.redoCommands.splice(0);
  };
}

export const commandStore = {
  getters: {
    [CAN_UNDO](state) {
      return state.undoCommands.length > 0;
    },
    [CAN_REDO](state) {
      return state.redoCommands.length > 0;
    },
  },

  mutations: {
    [PUSH_COMMAND](state, { command }: { command: Command<State> }) {
      Command.redo(state, command);
      state.undoCommands.push(command);
      state.redoCommands.splice(0);
    },
    [UNDO](state) {
      const command = state.undoCommands.pop();
      if (command != null) {
        Command.undo(state, command);
        state.redoCommands.push(command);
      }
    },
    [REDO](state) {
      const command = state.redoCommands.pop();
      if (command != null) {
        Command.redo(state, command);
        state.undoCommands.push(command);
      }
    },
  },

  actions: {
    [UNDO]({ commit }) {
      commit(UNDO);
    },
    [REDO]({ commit }) {
      commit(REDO);
    },
  },
} as StoreOptions<State>;
