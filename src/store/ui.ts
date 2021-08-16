import { Action, ActionContext, StoreOptions } from "vuex";
import { State } from "./type";

export const UI_LOCKED = "UI_LOCKED";
export const LOCK_UI = "LOCK_UI";
export const UNLOCK_UI = "UNLOCK_UI";
export const CREATE_HELP_WINDOW = "CREATE_HELP_WINDOW";
export const GET_USE_GPU = "GET_USE_GPU";
export const SET_USE_GPU = "SET_USE_GPU";

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
    [SET_USE_GPU](state, { useGpu }: { useGpu: boolean }) {
      state.useGpu = useGpu;
    },
  },

  actions: {
    [LOCK_UI]({ commit }) {
      commit(LOCK_UI);
    },
    [UNLOCK_UI]({ commit }) {
      commit(UNLOCK_UI);
    },
    [CREATE_HELP_WINDOW]() {
      window.electron.createHelpWindow();
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
  },
} as StoreOptions<State>;
