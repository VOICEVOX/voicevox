import { Action, ActionContext, ActionsBase } from "./vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  DialogContext,
  DialogName,
  DialogResult,
  DialogGetters,
  DialogActions,
  DialogMutations,
  DialogStoreState,
  VoiceVoxStoreOptions,
} from "@/store/type";

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
  ) => ReturnType<A[K]> | Promise<ReturnType<A[K]>>;
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

export const dialogStoreState: DialogStoreState = {
  dialogContexts: [],
};

export const dialogStore: VoiceVoxStoreOptions<
  DialogGetters,
  DialogActions,
  DialogMutations
> = {
  getters: {},
  mutations: {
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
    CLOSE_ALL_DIALOG({ state, commit }) {
      [...state.dialogContexts].reverse().forEach((ctx) => {
        commit("REMOVE_DIALOG_CONTEXT", ctx);
      });
    },

    OPEN_COMMON_DIALOG: createDialogAction({
      dialog: "COMMON",
      multiple: true,
      action(_context, _payload, result) {
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
