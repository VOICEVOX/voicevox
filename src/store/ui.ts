import { Action, ActionContext, ActionsBase } from "./vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  DialogContext,
  DialogName,
  DialogResult,
  UiActions,
  UiGetters,
  UiMutations,
  UiStoreState,
  VoiceVoxStoreOptions,
} from "./type";

export function createUILockAction<S, A extends ActionsBase, K extends keyof A>(
  action: (
    context: ActionContext<S, S, AllGetters, AllActions, AllMutations>,
    payload: Parameters<A[K]>[0]
  ) => ReturnType<A[K]> extends Promise<unknown>
    ? ReturnType<A[K]>
    : Promise<ReturnType<A[K]>>
): Action<S, S, A, K, AllGetters, AllActions, AllMutations> {
  return (context, payload: Parameters<A[K]>[0]) => {
    context.commit("LOCK_UI");
    return action(context, payload).finally(() => {
      context.commit("UNLOCK_UI");
    });
  };
}

// HACK: 型がかなり怪しいのでなんとかしたい…
export function createDialogAction<
  S,
  A extends ActionsBase,
  K extends keyof A,
  N extends DialogName
>({
  dialog,
  multiple,
  action,
}: {
  dialog: N;
  multiple?: boolean;
  action?: (
    context: ActionContext<S, S, AllGetters, AllActions, AllMutations>,
    payload: Parameters<A[K]>[0],
    result?: DialogResult<N>
  ) => ReturnType<A[K]> extends Promise<unknown>
    ? ReturnType<A[K]>
    : Promise<ReturnType<A[K]>>;
}): Action<S, S, A, K, AllGetters, AllActions, AllMutations> {
  return (context, payload) =>
    new Promise((resolve) => {
      const ctx = {
        dialog,
        multiple: multiple ?? false,
        result: async (result?: DialogResult<N>) => {
          resolve(await action?.(context, payload, result));
          context.commit("UNLOCK_UI");
          context.commit("UNLOCK_MENUBAR");
          context.commit("REMOVE_DIALOG_CONTEXT", ctx);
        },
        props: payload,
      } as DialogContext<N>;

      context.commit("LOCK_UI");
      context.commit("LOCK_MENUBAR");
      context.commit("ADD_DIALOG_CONTEXT", ctx);
    }) as never;
}

export const uiStoreState: UiStoreState = {
  uiLockCount: 0,
  dialogLockCount: 0,
  useGpu: false,
  inheritAudioInfo: true,
  isMaximized: false,
  isPinned: false,
  dialogContexts: [],
};

export const uiStore: VoiceVoxStoreOptions<UiGetters, UiActions, UiMutations> =
  {
    getters: {
      UI_LOCKED(state) {
        return state.uiLockCount > 0;
      },
      MENUBAR_LOCKED(state) {
        return state.dialogLockCount > 0;
      },
      SHOULD_SHOW_PANES(_, getters) {
        return getters.ACTIVE_AUDIO_KEY != undefined;
      },
    },

    mutations: {
      LOCK_UI(state) {
        state.uiLockCount++;
      },
      UNLOCK_UI(state) {
        state.uiLockCount--;
      },
      LOCK_MENUBAR(state) {
        state.dialogLockCount++;
      },
      UNLOCK_MENUBAR(state) {
        state.dialogLockCount--;
      },
      SET_USE_GPU(state, { useGpu }: { useGpu: boolean }) {
        state.useGpu = useGpu;
      },
      SET_INHERIT_AUDIOINFO(
        state,
        { inheritAudioInfo }: { inheritAudioInfo: boolean }
      ) {
        state.inheritAudioInfo = inheritAudioInfo;
      },
      DETECT_UNMAXIMIZED(state) {
        state.isMaximized = false;
      },
      DETECT_MAXIMIZED(state) {
        state.isMaximized = true;
      },
      DETECT_PINNED(state) {
        state.isPinned = true;
      },
      DETECT_UNPINNED(state) {
        state.isPinned = false;
      },

      ADD_DIALOG_CONTEXT(state, context) {
        if (
          !context.multiple &&
          state.dialogContexts.find((x) => x.dialog === context.dialog)
        )
          return;
        state.dialogContexts.push(context);
      },

      REMOVE_DIALOG_CONTEXT(state, context) {
        const idx = state.dialogContexts.indexOf(context);
        if (idx > -1) state.dialogContexts.splice(idx, 1);
      },
    },

    actions: {
      LOCK_UI({ commit }) {
        commit("LOCK_UI");
      },
      UNLOCK_UI({ commit }) {
        commit("UNLOCK_UI");
      },
      LOCK_MENUBAR({ commit }) {
        commit("LOCK_MENUBAR");
      },
      UNLOCK_MENUBAR({ commit }) {
        commit("UNLOCK_MENUBAR");
      },
      ASYNC_UI_LOCK: createUILockAction(
        async (_, { callback }: { callback: () => Promise<void> }) => {
          await callback();
        }
      ),
      ON_VUEX_READY() {
        window.electron.vuexReady();
      },
      async GET_USE_GPU({ commit }) {
        commit("SET_USE_GPU", {
          useGpu: await window.electron.useGpu(),
        });
      },
      async SET_USE_GPU({ commit }, { useGpu }: { useGpu: boolean }) {
        commit("SET_USE_GPU", {
          useGpu: await window.electron.useGpu(useGpu),
        });
      },
      async GET_INHERIT_AUDIOINFO({ commit }) {
        commit("SET_INHERIT_AUDIOINFO", {
          inheritAudioInfo: await window.electron.inheritAudioInfo(),
        });
      },
      async SET_INHERIT_AUDIOINFO(
        { commit },
        { inheritAudioInfo }: { inheritAudioInfo: boolean }
      ) {
        commit("SET_INHERIT_AUDIOINFO", {
          inheritAudioInfo: await window.electron.inheritAudioInfo(
            inheritAudioInfo
          ),
        });
      },
      async DETECT_UNMAXIMIZED({ commit }) {
        commit("DETECT_UNMAXIMIZED");
      },
      async DETECT_MAXIMIZED({ commit }) {
        commit("DETECT_MAXIMIZED");
      },
      async DETECT_PINNED({ commit }) {
        commit("DETECT_PINNED");
      },
      async DETECT_UNPINNED({ commit }) {
        commit("DETECT_UNPINNED");
      },
      async CHECK_EDITED_AND_NOT_SAVE({ getters }) {
        if (getters.IS_EDITED) {
          const result: number = await window.electron.showInfoDialog({
            title: "警告",
            message:
              "プロジェクトの変更が保存されていません。\n" +
              "変更を破棄してもよろしいですか？",
            buttons: ["破棄", "キャンセル"],
          });
          if (result == 1) {
            return;
          }
        }

        window.electron.closeWindow();
      },

      CLOSE_ALL_DIALOG({ state, commit }) {
        [...state.dialogContexts].reverse().forEach((ctx) => {
          commit("REMOVE_DIALOG_CONTEXT", ctx);
        });
      },

      OPEN_COMMON_DIALOG: createDialogAction({
        dialog: "COMMON",
        multiple: true,
        async action(_context, _payload, result) {
          return result;
        },
      }),

      OPEN_HOTKEY_SETTING_DIALOG: createDialogAction({
        dialog: "HOTKEY_SETTING",
      }),

      OPEN_DEFAULT_STYLE_SELECT_DIALOG: createDialogAction({
        dialog: "DEFAULT_STYLE_SELECT",
      }),

      OPEN_SETTING_DIALOG: createDialogAction({
        dialog: "SETTING",
      }),

      OPEN_HELP_DIALOG: createDialogAction({
        dialog: "HELP",
      }),

      OPEN_SAVE_ALL_RESULT_DIALOG: createDialogAction({
        dialog: "SAVE_ALL_RESULT",
      }),

      OPEN_ACCEPT_RETRIEVE_TELEMETRY_DIALOG: createDialogAction({
        dialog: "ACCEPT_RETRIEVE_TELEMETRY",
      }),
    },
  };
