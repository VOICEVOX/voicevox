import { Action, ActionContext, StoreOptions } from "vuex";
import { State, Encoding } from "./type";

export const UI_LOCKED = "UI_LOCKED";
export const LOCK_UI = "LOCK_UI";
export const UNLOCK_UI = "UNLOCK_UI";
export const GET_USE_GPU = "GET_USE_GPU";
export const SET_USE_GPU = "SET_USE_GPU";
export const SET_FILE_ENCODING = "SET_FILE_ENCODING";
export const IS_HELP_DIALOG_OPEN = "IS_HELP_DIALOG_OPEN";

export function createUILockAction<S, P>(
  action: (context: ActionContext<S, S>, payload: P) => Promise<any>
): Action<S, S> {
  return (context, payload: P) => {
    context.commit(LOCK_UI);
    return action(context, payload).finally(() => {
      context.commit(UNLOCK_UI);
    });
  };
}

export const uiStore = {
  getters: {
    [UI_LOCKED](state) {
      return state.uiLockCount > 0;
    },
  },

  mutations: {
    [LOCK_UI](state) {
      state.uiLockCount++;
    },
    [UNLOCK_UI](state) {
      state.uiLockCount--;
    },
    [IS_HELP_DIALOG_OPEN](
      state,
      { isHelpDialogOpen }: { isHelpDialogOpen: boolean }
    ) {
      state.isHelpDialogOpen = isHelpDialogOpen;
    },
    [SET_USE_GPU](state, { useGpu }: { useGpu: boolean }) {
      state.useGpu = useGpu;
    },
    [SET_FILE_ENCODING](state, { encoding }: { encoding: Encoding }) {
      state.fileEncoding = encoding;
    },
  },

  actions: {
    [LOCK_UI]({ commit }) {
      commit(LOCK_UI);
    },
    [UNLOCK_UI]({ commit }) {
      commit(UNLOCK_UI);
    },
    [IS_HELP_DIALOG_OPEN](
      { state, commit },
      { isHelpDialogOpen }: { isHelpDialogOpen: boolean }
    ) {
      if (state.isHelpDialogOpen === isHelpDialogOpen) return;

      if (isHelpDialogOpen) commit(LOCK_UI);
      else commit(UNLOCK_UI);

      commit(IS_HELP_DIALOG_OPEN, { isHelpDialogOpen });
    },
    async [GET_USE_GPU]({ commit }) {
      commit(SET_USE_GPU, {
        useGpu: await window.electron.useGpu(),
      });
    },
    async [SET_USE_GPU]({ commit }, { useGpu }: { useGpu: boolean }) {
      commit(SET_USE_GPU, {
        useGpu: await window.electron.useGpu(useGpu),
      });
    },
    async [SET_FILE_ENCODING](
      { commit },
      { encoding }: { encoding: Encoding }
    ) {
      commit(SET_FILE_ENCODING, { encoding });
    },
  },
} as StoreOptions<State>;
