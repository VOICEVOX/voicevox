import {
  defineStore,
  StoreDefinition,
  Store,
  StateTree,
  DefineStoreOptions,
} from "pinia";
import { ref, computed, UnwrapRef } from "vue";
import { enablePatches, enableMapSet, Immer, Patch } from "immer";
// immerの内部関数であるgetPlugin("Patches").applyPatches_はexportされていないので
// ビルド前のsrcからソースコードを読み込んで使う必要がある
import { enablePatches as enablePatchesImpl } from "immer/src/plugins/patches";
import { enableMapSet as enableMapSetImpl } from "immer/src/plugins/mapset";
import { getPlugin } from "immer/src/utils/plugins";

import {
  StateController,
  StateStoreDefinition,
  StateStore,
  MutationDefinition,
  Mutation,
  Action,
  Writable,
} from "./pinia_helper";

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

const useStateObj: Record<string, StoreDefinition> = {};
/**
 * Commandに対応したStateを持つStoreはcommandのpinia storeからアクセスするため
 * {useStateObj}にuseStoreを登録する. そのため定義はdefineCommandableStateを経由
 * させる
 */
export const defineCommandableState = <Id extends string, S extends StateTree>(
  option: DefineStoreOptions<Id, S, Record<never, never>, Record<never, never>>
) => {
  const useStore = defineStore(option);
  useStateObj[option.id] = useStore;
  return new CommandableStateController(option.id, useStore);
};

/**
 * コマンド履歴の管理及びundo/redoを行う
 */
export const useCommand = defineStore("command", () => {
  const storeIdMap = Object.fromEntries(
    Object.entries(useStateObj).map(
      ([id, useStore]) => [id, useStore()] as const
    )
  );
  const stackedPatchesHistory = ref<CommandPatches[]>([]);
  const poppedPatchesHistory = ref<CommandPatches[]>([]);

  const undoable = computed(() => stackedPatchesHistory.value.length !== 0);
  const redoable = computed(() => poppedPatchesHistory.value.length !== 0);

  const undo = () => {
    const command = stackedPatchesHistory.value.pop();
    if (command == undefined) return;
    for (const [storeId, { undoPatches }] of Object.entries(command)) {
      updateStore(storeIdMap[storeId], undoPatches);
    }
    poppedPatchesHistory.value.push(command);
  };

  const redo = () => {
    const command = poppedPatchesHistory.value.pop();
    if (command == undefined) return;
    for (const [storeId, { redoPatches }] of Object.entries(command)) {
      updateStore(storeIdMap[storeId], redoPatches);
    }
    stackedPatchesHistory.value.push(command);
  };

  const $pushCommand = (command: CommandPatches) => {
    poppedPatchesHistory.value = [];
    stackedPatchesHistory.value.push(command);
  };

  return {
    $pushCommand,
    undoable,
    redoable,
    undo,
    redo,
  };
});

type CommandPatches = Record<
  string,
  {
    redoPatches: Patch[];
    undoPatches: Patch[];
  }
>;

export class CommandableStateController<
  Id extends string,
  S extends StateTree
> extends StateController<Id, S> {
  constructor(id: Id, useStore: StateStoreDefinition<Id, S>) {
    super(id, useStore);
  }

  public useContext() {
    const contexts = super.useContext();
    const commandStore = useCommand();
    const defCmd = <
      MPayloads extends unknown[],
      APayloads extends unknown[],
      Ret
    >(
      mutation: MutationDefinition<S, MPayloads>,
      action: (
        mutation: (...payloads: MPayloads) => void,
        ...payloads: APayloads
      ) => Ret
    ) => defCommand(commandStore, contexts._writableState, mutation, action);
    const asCmd = <Payloads extends unknown[]>(
      mutation: MutationDefinition<S, Payloads>
    ): Command<(...payloads: Payloads) => void> & Mutation<S, Payloads> => {
      const mut = contexts.defMut(mutation);
      return {
        ...mut,
        dispatch: contexts.asAct(mutation),
        command: convertAsCommand(
          commandStore,
          contexts._writableState,
          mutation
        ),
      };
    };

    return {
      ...contexts,
      defCmd,
      asCmd,
    };
  }
}

function updateStore(store: Store, patches: Patch[]) {
  store.$patch((state: StateTree) => {
    applyPatchesImpl(state, patches);
  });
}

const convertAsCommand = <
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[]
>(
  commandStore: { $pushCommand(command: CommandPatches): void },
  store: StateStore<Id, S>,
  mutation: MutationDefinition<S, Payloads>
) => {
  return (...payloads: Payloads) => {
    // Record operations
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      store.$state,
      (draft) => mutation(draft as Writable<UnwrapRef<S>>, ...payloads)
    );
    // apply patches
    updateStore(store as Store, redoPatches);
    commandStore.$pushCommand({
      [store.$id]: {
        redoPatches: redoPatches,
        undoPatches: undoPatches,
      },
    });
  };
};

export const defCommand = <
  Id extends string,
  S extends StateTree,
  MPayloads extends unknown[],
  APayloads extends unknown[],
  Ret
>(
  commandStore: { $pushCommand(command: CommandPatches): void },
  state: StateStore<Id, S>,
  mutation: MutationDefinition<S, MPayloads>,
  action: (
    commit: (...payloads: MPayloads) => void,
    ...payloads: APayloads
  ) => Ret
): Command<(...payloads: APayloads) => Ret> => {
  const commandFunc = convertAsCommand(commandStore, state, mutation);
  return {
    dispatch: (...payloads: APayloads) =>
      action(
        (...mpayloads: MPayloads) =>
          mutation(state as UnwrapRef<Writable<S>>, ...mpayloads),
        ...payloads
      ),
    command: (...payloads: APayloads) => action(commandFunc, ...payloads),
  };
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type Command<A extends Function> = Action<A> & {
  command: A;
};
