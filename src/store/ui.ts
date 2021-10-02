import { Action, ActionContext, ActionsBase } from "./vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  UiActions,
  UiGetters,
  UiMutations,
  VoiceVoxStoreOptions,
} from "./type";

export function createUILockAction<S, A extends ActionsBase, K extends keyof A>(
  action: (
    context: ActionContext<S, S, AllGetters, AllActions, AllMutations>,
    payload: Parameters<A[K]>[0]
  ) => ReturnType<A[K]> extends Promise<any>
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

export const uiStore: VoiceVoxStoreOptions<UiGetters, UiActions, UiMutations> =
  {
    getters: {
      UI_LOCKED(state) {
        return state.uiLockCount > 0;
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
      IS_HELP_DIALOG_OPEN(
        state,
        { isHelpDialogOpen }: { isHelpDialogOpen: boolean }
      ) {
        state.isHelpDialogOpen = isHelpDialogOpen;
      },
      IS_SETTING_DIALOG_OPEN(
        state,
        { isSettingDialogOpen }: { isSettingDialogOpen: boolean }
      ) {
        state.isSettingDialogOpen = isSettingDialogOpen;
      },
      SET_USE_GPU(state, { useGpu }: { useGpu: boolean }) {
        state.useGpu = useGpu;
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
    },

    actions: {
      LOCK_UI({ commit }) {
        commit("LOCK_UI");
      },
      UNLOCK_UI({ commit }) {
        commit("UNLOCK_UI");
      },
      ASYNC_UI_LOCK: createUILockAction(
        async (_, { callback }: { callback: () => Promise<void> }) => {
          await callback();
        }
      ),
      IS_HELP_DIALOG_OPEN(
        { state, commit },
        { isHelpDialogOpen }: { isHelpDialogOpen: boolean }
      ) {
        if (state.isHelpDialogOpen === isHelpDialogOpen) return;

        if (isHelpDialogOpen) commit("LOCK_UI");
        else commit("UNLOCK_UI");

        commit("IS_HELP_DIALOG_OPEN", { isHelpDialogOpen });
      },
      IS_SETTING_DIALOG_OPEN(
        { state, commit },
        { isSettingDialogOpen }: { isSettingDialogOpen: boolean }
      ) {
        if (state.isSettingDialogOpen === isSettingDialogOpen) return;

        if (isSettingDialogOpen) commit("LOCK_UI");
        else commit("UNLOCK_UI");

        commit("IS_SETTING_DIALOG_OPEN", { isSettingDialogOpen });
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
    },
  };
