import { Action, ActionContext, ActionsBase } from "./vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  UiStoreState,
  UiStoreTypes,
} from "./type";
import { ActivePointScrollMode } from "@/type/preload";
import { createPartialStore } from "./vuex";

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

export const uiStoreState: UiStoreState = {
  uiLockCount: 0,
  dialogLockCount: 0,
  useGpu: false,
  inheritAudioInfo: true,
  activePointScrollMode: "OFF",
  isHelpDialogOpen: false,
  isSettingDialogOpen: false,
  isHotkeySettingDialogOpen: false,
  isToolbarSettingDialogOpen: false,
  isCharacterOrderDialogOpen: false,
  isDefaultStyleSelectDialogOpen: false,
  isAcceptRetrieveTelemetryDialogOpen: false,
  isAcceptTermsDialogOpen: false,
  isDictionaryManageDialogOpen: false,
  isEngineManageDialogOpen: false,
  isMaximized: false,
  isPinned: false,
  isFullscreen: false,
  progress: -1,
  progressCount: 0,
};

export const uiStore = createPartialStore<UiStoreTypes>({
  UI_LOCKED: {
    getter(state) {
      return state.uiLockCount > 0;
    },
  },

  MENUBAR_LOCKED: {
    getter(state) {
      return state.dialogLockCount > 0;
    },
  },

  ASYNC_UI_LOCK: {
    action: createUILockAction(
      async (_, { callback }: { callback: () => Promise<void> }) => {
        await callback();
      }
    ),
  },

  LOCK_UI: {
    mutation(state) {
      state.uiLockCount++;
    },
    action({ commit }) {
      commit("LOCK_UI");
    },
  },

  UNLOCK_UI: {
    mutation(state) {
      if (state.uiLockCount !== 0) {
        state.uiLockCount--;
      } else {
        // eslint-disable-next-line no-console
        console.warn("UNLOCK_UI is called when state.uiLockCount == 0");
      }
    },
    action({ commit }) {
      commit("UNLOCK_UI");
    },
  },

  LOCK_MENUBAR: {
    mutation(state) {
      state.dialogLockCount++;
    },
    action({ commit }) {
      commit("LOCK_MENUBAR");
    },
  },

  UNLOCK_MENUBAR: {
    mutation(state) {
      state.dialogLockCount--;
    },
    action({ commit }) {
      commit("UNLOCK_MENUBAR");
    },
  },

  SHOULD_SHOW_PANES: {
    getter(_, getters) {
      return getters.ACTIVE_AUDIO_KEY != undefined;
    },
  },

  SET_DIALOG_OPEN: {
    mutation(
      state,
      dialogState: {
        isDefaultStyleSelectDialogOpen?: boolean;
        isAcceptRetrieveTelemetryDialogOpen?: boolean;
        isAcceptTermsDialogOpen?: boolean;
        isDictionaryManageDialogOpen?: boolean;
        isHelpDialogOpen?: boolean;
        isSettingDialogOpen?: boolean;
        isHotkeySettingDialogOpen?: boolean;
        isToolbarSettingDialogOpen?: boolean;
        isCharacterOrderDialogOpen?: boolean;
        isEngineManageDialogOpen?: boolean;
      }
    ) {
      for (const [key, value] of Object.entries(dialogState)) {
        if (!(key in state)) {
          throw new Error(`Unknown dialog state: ${key}`);
        }
        state[key] = value;
      }
    },
    async action({ state, commit }, dialogState) {
      for (const [key, value] of Object.entries(dialogState)) {
        if (state[key] === value) continue;

        if (value) {
          commit("LOCK_UI");
          commit("LOCK_MENUBAR");
        } else {
          commit("UNLOCK_UI");
          commit("UNLOCK_MENUBAR");
        }
      }

      commit("SET_DIALOG_OPEN", dialogState);
    },
  },

  HYDRATE_UI_STORE: {
    async action({ commit }) {
      commit("SET_USE_GPU", {
        useGpu: await window.electron.getSetting("useGpu"),
      });

      commit("SET_INHERIT_AUDIOINFO", {
        inheritAudioInfo: await window.electron.getSetting("inheritAudioInfo"),
      });

      commit("SET_ACTIVE_POINT_SCROLL_MODE", {
        activePointScrollMode: await window.electron.getSetting(
          "activePointScrollMode"
        ),
      });

      // electron-window-stateがvuex初期化前に働くので
      // ここで改めてelectron windowの最大化状態をVuex storeに同期
      if (await window.electron.isMaximizedWindow()) {
        commit("DETECT_MAXIMIZED");
      }
    },
  },

  ON_VUEX_READY: {
    action() {
      window.electron.vuexReady();
    },
  },

  SET_USE_GPU: {
    mutation(state, { useGpu }: { useGpu: boolean }) {
      state.useGpu = useGpu;
    },
    async action({ commit }, { useGpu }: { useGpu: boolean }) {
      commit("SET_USE_GPU", {
        useGpu: await window.electron.setSetting("useGpu", useGpu),
      });
    },
  },

  SET_INHERIT_AUDIOINFO: {
    mutation(state, { inheritAudioInfo }: { inheritAudioInfo: boolean }) {
      state.inheritAudioInfo = inheritAudioInfo;
    },
    async action(
      { commit },
      { inheritAudioInfo }: { inheritAudioInfo: boolean }
    ) {
      commit("SET_INHERIT_AUDIOINFO", {
        inheritAudioInfo: await window.electron.setSetting(
          "inheritAudioInfo",
          inheritAudioInfo
        ),
      });
    },
  },

  SET_ACTIVE_POINT_SCROLL_MODE: {
    mutation(
      state,
      {
        activePointScrollMode,
      }: { activePointScrollMode: ActivePointScrollMode }
    ) {
      state.activePointScrollMode = activePointScrollMode;
    },
    async action(
      { commit },
      {
        activePointScrollMode,
      }: { activePointScrollMode: ActivePointScrollMode }
    ) {
      commit("SET_ACTIVE_POINT_SCROLL_MODE", {
        activePointScrollMode: await window.electron.setSetting(
          "activePointScrollMode",
          activePointScrollMode
        ),
      });
    },
  },

  DETECT_UNMAXIMIZED: {
    mutation(state) {
      state.isMaximized = false;
    },
    action({ commit }) {
      commit("DETECT_UNMAXIMIZED");
    },
  },

  DETECT_MAXIMIZED: {
    mutation(state) {
      state.isMaximized = true;
    },
    action({ commit }) {
      commit("DETECT_MAXIMIZED");
    },
  },

  DETECT_PINNED: {
    mutation(state) {
      state.isPinned = true;
    },
    action({ commit }) {
      commit("DETECT_PINNED");
    },
  },

  DETECT_UNPINNED: {
    mutation(state) {
      state.isPinned = false;
    },
    action({ commit }) {
      commit("DETECT_UNPINNED");
    },
  },

  DETECT_ENTER_FULLSCREEN: {
    mutation(state) {
      state.isFullscreen = true;
    },
    action({ commit }) {
      commit("DETECT_ENTER_FULLSCREEN");
    },
  },

  DETECT_LEAVE_FULLSCREEN: {
    mutation(state) {
      state.isFullscreen = false;
    },
    action({ commit }) {
      commit("DETECT_LEAVE_FULLSCREEN");
    },
  },

  IS_FULLSCREEN: {
    getter(state) {
      return state.isFullscreen;
    },
  },

  CHECK_EDITED_AND_NOT_SAVE: {
    async action({ getters }) {
      if (getters.IS_EDITED) {
        const result: number = await window.electron.showQuestionDialog({
          type: "info",
          title: "警告",
          message:
            "プロジェクトの変更が保存されていません。\n" +
            "変更を破棄してもよろしいですか？",
          buttons: ["破棄", "キャンセル"],
          cancelId: 1,
        });
        if (result == 1) {
          return;
        }
      }

      window.electron.closeWindow();
    },
  },

  RESTART_APP: {
    action(_, { isSafeMode }: { isSafeMode?: boolean }) {
      window.electron.restartApp({ isSafeMode: !!isSafeMode });
    },
  },

  START_PROGRESS: {
    action({ dispatch }, { count }) {
      dispatch("SET_PROGRESS", { progress: 0, count });
    },
  },

  START_AUDIO_ITEMS_PROGRESS: {
    action({ dispatch, state }) {
      dispatch("START_PROGRESS", { count: state.audioKeys.length });
    },
  },

  INCREMENT_PROGRESS: {
    action({ dispatch, state }) {
      const step = 1.0 / state.progressCount;
      dispatch("SET_PROGRESS", { progress: state.progress + step });
    },
  },

  START_INDETERMINATE_PROGRESS: {
    action({ dispatch }) {
      // electron.setProgressBarに1より大きい値を渡すとindeterminateなプログレスバーになる
      dispatch("SET_PROGRESS", { progress: 1.1 });
    },
  },

  SET_PROGRESS: {
    mutation(state, { progress, count }) {
      state.progress = progress;
      if (count != null) {
        state.progressCount = count;
      }
    },
    action({ commit }, { progress, count }) {
      window.electron.setProgressBar({ progress });
      commit("SET_PROGRESS", { progress, count });
    },
  },

  RESET_PROGRESS: {
    action({ dispatch }) {
      dispatch("SET_PROGRESS", { progress: -1 });
    },
  },
});
