import { enablePatches, enableMapSet, Patch, Draft, Immer } from "immer";
import { applyPatch, Operation } from "rfc6902";

import { State } from "./type";
import { never_used } from "immer/dist/internal";

enablePatches();
enableMapSet();

const immer = new Immer();
immer.setAutoFreeze(false);

type Recipe<S, P> = (draft: Draft<S>, payload?: P) => void;
type Mutation<S, P> = (state: S, payload?: P) => void;
type Command = {
  doOperation: Operation[];
  undoOperation: Operation[];
};

interface UndoRedoState {
  undoCommands: Command[];
  redoCommands: Command[];
}

const createCommandsFromRecipes =
  <S extends UndoRedoState>() =>
  <R extends Record<string, Recipe<S, any>>>(
    recipes: R
  ): { [K in keyof R]: Mutation<S, Parameters<R[K]>[1]> } =>
    Object.fromEntries(
      Object.entries(recipes).map(([key, recipe]) => [
        key,
        createCommandMutation(recipe),
      ])
    ) as { [K in keyof R]: Mutation<S, Parameters<R[K]>[1]> };

const createCommandMutation =
  <S extends UndoRedoState, P>(recipe: Recipe<S, P>) =>
  (state: S, payload: P) => {
    const command = recordOperations(recipe)(state, payload);
    applyPatch(state, command.doOperation);
    state.undoCommands.push(command);
  };

const patchToOperation = (patch: Patch): Operation => ({
  op: patch.op,
  path: `/${patch.path.join("/")}`,
  value: patch.value,
});

const recordOperations =
  <S, P>(recipe: Recipe<S, P>) =>
  (state: S, payload?: P): Command => {
    const [_, doPatches, undoPatches] = immer.produceWithPatches(
      state,
      (draft: Draft<S>) => recipe(draft, payload)
    );
    return {
      doOperation: doPatches.map(patchToOperation),
      undoOperation: undoPatches.map(patchToOperation),
    };
  };

const x = createCommandsFromRecipes<State>({
  TEST: (draft, payload: number) => {
    return;
  },
} as const);

x.TEST(null as State);
