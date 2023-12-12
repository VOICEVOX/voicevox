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
    if (command == undefined) return;
    for (const [storeId, { undoPatches }] of Object.entries(command)) {
      updateStore(storeIdMap[storeId], undoPatches);
    }
    poppedPatchesHistory.value.push(command);
  };

  const redo = () => {
    const command = poppedPatchesHistory.value.pop();
    if (command == undefined) return;
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

/**
 * Stateに対してController(`mutation`, `action`, `command`)を用いた操作を定義するための関数
 * Stateが`Command`に対応しており`mutation`の変更を記録してundo/redoに用いることができる。
 */
export class CommandableStateController<
  Id extends string,
  S extends StateTree
> extends StateController<Id, S> {
  constructor(id: Id, useStore: StateStoreDefinition<Id, S>) {
    super(id, useStore);
  }

  /**
   * getter, mutation, action, commandを定義するためのcontextヘルパー (defGet, defMut, defAct, defCmd) を得る関数
   **/
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
    const asNonRecordActInternal = <Payloads extends unknown[], Ret>(
      command: Command<Id, S, Payloads, Ret>
    ) => asNonRecordAct<Id, S, Payloads, Ret>(command);

    return {
      ...contexts,
      /**
       * `Command`を定義する為の関数
       * @param commandDef - `command`の定義関数
       * @example
       * const command1 = defCmd(({recordCommit}) => recordCommit(mutation1));
       * const command2 = defCmd(async ({get, recordCommit}) => {
       *   const arg = await preProcess(get(getter1));
       *   recordCommit(mutation2, arg);
       *   return await postProcess(get(getter2));
       * });
       */
      defCmd,
      /**
       * `Command`の`recordCommit`を無効化し, 記録を行わない通常の`Action`に変換する関数
       * @example
       * const action3 = asNonRecordAct(command3);
       */
      asNonRecordAct: asNonRecordActInternal,
    };
  }
}

/**
 * .vueファイルや他モジュールでimportした`getter`, `action`, `command`を呼び出すための関数
 * @example
 * const store = useStore();
 * const { get, dispatch, commandDispatch } = useController();
 * const ref1 = computed(() => get(store.getter1));
 * const onChange = (text: string) => dispatch(store.action1, text);
 * const onChangeRecord = (text: string) => commandDispatch(store.command1, text);
 */
export function useController(...args: Parameters<StoreDefinition>) {
  const commandStore = useCommand(...args);
  const callers = useControllerOrig();
  const commandDispatch = templateCommandDispatchWithoutStore(commandStore);
  return {
    ...callers,
    /**
     * `Command`を呼び出す為の関数
     * @example
     * const ret1 = commandDispatch(store.command1, text);
     */
    commandDispatch,
  };
}

/**
 * 引数に取ったCommand内で用いられているMutation及びCommandのundo/redoの記録を無効化する
 * @param {Command<Id, S, Payloads, Ret>} command - 記録を無効化したいCommand
 * @returns {Action<Id, S, Payloads, Ret>} 記録を無効化したaction
 */
export function asNonRecordAct<
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
      dispatch(asNonRecordAct<_Id, _S, _Payloads, _Ret>(command), ...payloads);
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
  /**
   * 対象の`Store`が持っている`state` (readonly)
   */
  state: DeepReadonly<UnwrapRef<S>>;
  /**
   * getterを呼ぶための関数
   **/
  get: Get<Id, S>;
  /**
   * mutationを呼ぶための関数
   */
  commit: Commit<Id, S>;
  /**
   * mutationを呼び、その変更を記録してundo/redoを可能にする関数
   * @desc
   * この関数を用いてmutationを呼んだ場合、mutationの変更記録がimmerによって記録される。
   * undo/redoではこの変更の記録を用いてstateのundoやredoを行っている。
   * そのため、undo/redoの変更単位は`mutation`の変更単位と一致するため、
   * commandの中で`recordCommit`を複数回叩くと、叩いた数だけ履歴が積まれる。
   * したがって非同期処理などのmutationに含むことができない処理は事前に行い、
   * `mutation`を纏め`recordCommit`を叩く回数を1回にする等の工夫が必要になる。
   */
  recordCommit: Commit<Id, S>;
  /**
   * actionを呼ぶための関数
   */
  dispatch: Dispatch;
  /**
   * 他のcommandを呼ぶための関数
   */
  commandDispatch: CommandDispatch;
};
export type CommandDefinition<
  Id extends string,
  S extends StateTree,
  Payloads extends unknown[],
  Ret
> = (
  // `state`, `getter`, `mutation`, `action`, `command`を参照する為のコンテキストが渡される引数
  context: CommandContext<Id, S>,
  // commandの引数
  ...payloads: Payloads
) => Ret;
/**
 * `Command`の実態
 * `context`として渡される`commandDispatch`関数を用いて呼び出すことができる。
 */
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
