import { Action, ActionContext, StoreOptions } from "vuex";
import { State } from "./type";

export const UI_LOCKED = "UI_LOCKED";
export const LOCK_UI = "LOCK_UI";
export const UNLOCK_UI = "UNLOCK_UI";
export const SET_AUDIO_DETAIL_PANE_OFFSET = "SET_AUDIO_DETAIL_PANE_OFFSET";
export const SET_AUDIO_INFO_PANE_OFFSET = "SET_AUDIO_INFO_PANE_OFFSET";
export const CREATE_HELP_WINDOW = "CREATE_HELP_WINDOW";

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
    [SET_AUDIO_DETAIL_PANE_OFFSET](state, { offset }: { offset: number }) {
      state.audioDetailPaneOffset = offset;
    },
    [SET_AUDIO_INFO_PANE_OFFSET](state, { offset }: { offset: number }) {
      state.audioInfoPaneOffset = offset;
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
  },
} as StoreOptions<State>;
