import {
  defineStore,
  StoreDefinition,
  Store,
  StateTree,
  DefineStoreOptions,
} from "pinia";
import { ref, computed, UnwrapRef, DeepReadonly } from "vue";
import { enablePatches, enableMapSet, Immer, Patch } from "immer";
// immerの内部関数であるgetPlugin("Patches").applyPatches_はexportされていないので
// ビルド前のsrcからソースコードを読み込んで使う必要がある
import { enablePatches as enablePatchesImpl } from "immer/src/plugins/patches";
import { enableMapSet as enableMapSetImpl } from "immer/src/plugins/mapset";
import { getPlugin } from "immer/src/utils/plugins";

import {
  StateController,
  StateStoreDefinition,
  useController as useControllerOrig,
  Get,
  Commit,
  Dispatch,
  templateGet,
  templateCommit,
  templateDispatchWithoutStore,
  Mutation,
  MutationContext,
  Action,
  ActionDefinition,
  STORE_TAG,
  MUTATION_TAG,
  ACTION_TAG,
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
 * `Command`に対応したStateを持つ`store`は`commandStore`からアクセスするため`useStateObj`に`useStore`を登録する.
 * `defineCommandableState`を経由してstateを定義することで`useStateObj`に登録される．
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
    if (command === undefined) return;
    for (const [storeId, { undoPatches }] of Object.entries(command)) {
      updateStore(storeIdMap[storeId], undoPatches);
    }
    poppedPatchesHistory.value.push(command);
  };

  const redo = () => {
    const command = poppedPatchesHistory.value.pop();
    if (command === undefined) return;
    for (const [storeId, { doPatches }] of Object.entries(command)) {
      updateStore(storeIdMap[storeId], doPatches);
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
    doPatches: Patch[];
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

  public useControllerContext(...args: Parameters<StoreDefinition>) {
    const contexts = super.useControllerContext(...args);
    const commandStore = useCommand(...args);
    const defCmd = <Payloads extends unknown[], Ret>(
      commandDef: CommandDefinition<Id, S, Payloads, Ret>
    ): Command<Id, S, Payloads, Ret> => ({
      [COMMAND_TAG]: commandDef,
      [STORE_TAG]: contexts._store,
      [COMMAND_STORE_TAG]: commandStore,
    });
    const invalidateRecordInternal = <Payloads extends unknown[], Ret>(
      command: Command<Id, S, Payloads, Ret>
    ) => invalidateRecord<Id, S, Payloads, Ret>(command);

    return {
      ...contexts,
      defCmd,
      invalidateRecord: invalidateRecordInternal,
    };
  }
}

export function useController(...args: Parameters<StoreDefinition>) {
  const comamndStore = useCommand(...args);
  const callers = useControllerOrig();
  const commandDispatch = templateCommandDispatchWithoutStore(comamndStore);
  return {
    ...callers,
    commandDispatch,
  };
}

/**
 * 引数に取ったCommand内で用いられているMutation及びCommandのundo/redoの記録を無効化する
 * @param {Command<Id, S, Payloads, Ret>} command - 記録を無効化したいCommand
 * @returns {Action<Id, S, Payloads, Ret>} 記録を無効化したaction
 */
export function invalidateRecord<
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[],
  Ret
>(command: Command<Id, S, Payloads, Ret>): Action<Id, S, Payloads, Ret> {
  const commandDef: CommandDefinition<Id, S, Payloads, Ret> =
    command[COMMAND_TAG];
  // dispatchからcommandDispatchを生成する
  function templateCommandDispatch(dispatch: Dispatch): CommandDispatch {
    return <
      _Id extends string,
      _S extends StateTree,
      _Payloads extends unknown[],
      _Ret
    >(
      command: Command<_Id, _S, _Payloads, _Ret>,
      ...payloads: _Payloads
    ) =>
      dispatch(
        invalidateRecord<_Id, _S, _Payloads, _Ret>(command),
        ...payloads
      );
  }
  const actionDef: ActionDefinition<Id, S, Payloads, Ret> = (
    ctx,
    ...payloads
  ) =>
    commandDef(
      {
        ...ctx,
        recordCommit: ctx.commit,
        commandDispatch: templateCommandDispatch(ctx.dispatch),
      },
      ...payloads
    );
  return {
    [STORE_TAG]: command[STORE_TAG],
    [ACTION_TAG]: actionDef,
  };
}

export function templateCommandDispatchWithoutStore(
  commandStore: CommandStoreInterface
): CommandDispatch {
  function commandDispatch<
    Id extends string,
    S extends StateTree,
    Payloads extends unknown[],
    Ret
  >(command: Command<Id, S, Payloads, Ret>, ...payloads: Payloads) {
    const state = command[STORE_TAG];
    const commandContext: CommandContext<Id, S> = {
      state: state as DeepReadonly<UnwrapRef<S>>,
      get: templateGet<Id, S>(state as DeepReadonly<UnwrapRef<S>>),
      commit: templateCommit<Id, S>(state),
      recordCommit: templateRecordCommit(state, commandStore),
      dispatch: templateDispatchWithoutStore(),
      commandDispatch: commandDispatch,
    };
    return command[COMMAND_TAG](commandContext, ...payloads);
  }
  return commandDispatch;
}

export function templateRecordCommit<Id extends string, S extends StateTree>(
  store: Store<Id, S>,
  commandStore: CommandStoreInterface
): Commit<Id, S> {
  function recordCommit<Payloads extends unknown[]>(
    mutaiton: Mutation<Id, S, Payloads>,
    ...payloads: Payloads
  ) {
    const [, doPatches, undoPatches] = immer.produceWithPatches(
      store.$state,
      (draft: UnwrapRef<S>) => {
        const mutationContext: MutationContext<Id, S> = {
          state: draft,
          get: templateGet<Id, S>(draft as DeepReadonly<UnwrapRef<S>>),
          commit: templateCommit(draft),
        };
        mutaiton[MUTATION_TAG](mutationContext, ...payloads);
      }
    );
    updateStore(store as Store, doPatches);
    commandStore.$pushCommand({
      [store.$id]: {
        doPatches,
        undoPatches,
      },
    });
  }
  return recordCommit;
}

function updateStore(store: Store, patches: Patch[]) {
  store.$patch((state: unknown) => {
    applyPatchesImpl(state, patches);
  });
}

// symbol for hiding
export const COMMAND_TAG: unique symbol = Symbol();
export const COMMAND_STORE_TAG: unique symbol = Symbol();

// Context function
export type CommandDispatch = <
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[],
  Ret
>(
  command: Command<Id, S, Payloads, Ret>,
  ...payloads: Payloads
) => Ret;

// Command
export type CommandContext<Id extends string, S extends StateTree> = {
  state: DeepReadonly<UnwrapRef<S>>;
  get: Get<Id, S>;
  commit: Commit<Id, S>;
  recordCommit: Commit<Id, S>;
  dispatch: Dispatch;
  commandDispatch: CommandDispatch;
};
export type CommandDefinition<
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[],
  Ret
> = (context: CommandContext<Id, S>, ...payloads: Payloads) => Ret;
export type Command<
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[],
  Ret
> = {
  [COMMAND_TAG]: CommandDefinition<Id, S, Payloads, Ret>;
  [STORE_TAG]: Store<Id, S>;
  [COMMAND_STORE_TAG]: CommandStoreInterface;
};

type CommandStoreInterface = { $pushCommand(command: CommandPatches): void };
