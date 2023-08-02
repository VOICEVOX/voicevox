import { Action, ActionContext, ActionsBase, Dispatch } from "./vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  UiStoreState,
  UiStoreTypes,
} from "./type";
import { createPartialStore } from "./vuex";
import { ActivePointScrollMode } from "@/type/preload";
import {
  CommonDialogOptions,
  LoadingScreenOption,
  NotifyAndNotShowAgainButtonOption,
  hideAllLoadingScreen,
  showAlertDialog,
  showConfirmDialog,
  showLoadingScreen,
  showNotifyAndNotShowAgainButton,
  showWarningDialog,
} from "@/components/Dialog";

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

export function withProgress<T>(
  action: Promise<T>,
  dispatch: Dispatch<AllActions>
): Promise<T> {
  dispatch("START_PROGRESS");
  return action.finally(() => dispatch("RESET_PROGRESS"));
}

export const uiStoreState: UiStoreState = {
  uiLockCount: 0,
  dialogLockCount: 0,
  reloadingLock: false,
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
  isVuexReady: false,
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

  PROGRESS: {
    getter(state) {
      return state.progress;
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
        window.electron.logWarn(
          "UNLOCK_UI is called when state.uiLockCount == 0"
        );
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

  /**
   * 再読み込み中。UNLOCKされることはない。
   */
  LOCK_RELOADING: {
    mutation(state) {
      state.reloadingLock = true;
    },
    action({ commit }) {
      commit("LOCK_RELOADING");
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

  SHOW_ALERT_DIALOG: {
    action: createUILockAction(
      async (_, payload: { title: string; message: string; ok?: string }) => {
        return await showAlertDialog(payload);
      }
    ),
  },

  SHOW_CONFIRM_DIALOG: {
    action: createUILockAction(
      async (_, payload: CommonDialogOptions["confirm"]) => {
        return await showConfirmDialog(payload);
      }
    ),
  },

  SHOW_WARNING_DIALOG: {
    action: createUILockAction(
      async (_, payload: CommonDialogOptions["warning"]) => {
        return await showWarningDialog(payload);
      }
    ),
  },

  SHOW_NOTIFY_AND_NOT_SHOW_AGAIN_BUTTON: {
    action({ dispatch }, payload: NotifyAndNotShowAgainButtonOption) {
      showNotifyAndNotShowAgainButton({ dispatch }, payload);
    },
  },

  SHOW_LOADING_SCREEN: {
    action(_, payload: LoadingScreenOption) {
      showLoadingScreen(payload);
    },
  },

  HIDE_ALL_LOADING_SCREEN: {
    action() {
      hideAllLoadingScreen();
    },
  },

  HYDRATE_UI_STORE: {
    async action({ commit }) {
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
    mutation(state) {
      state.isVuexReady = true;
    },
    action({ commit }) {
      window.electron.vuexReady();
      commit("ON_VUEX_READY");
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
    /**
     * プロジェクトファイル未保存の場合、保存するかどうかを確認する。
     * 保存後にウィンドウを閉じるか、アプリを再読み込みする。
     * 保存がキャンセルされた場合は何もしない。
     */
    async action({ dispatch, getters }, obj) {
      if (getters.IS_EDITED) {
        const result = await dispatch("SAVE_OR_DISCARD_PROJECT_FILE", {});
        if (result == "canceled") {
          return;
        }
      }

      if (obj.closeOrReload == "close") {
        window.electron.closeWindow();
      } else if (obj.closeOrReload == "reload") {
        await dispatch("RELOAD_APP", {
          isMultiEngineOffMode: obj.isMultiEngineOffMode,
        });
      }
    },
  },

  RELOAD_APP: {
    action: createUILockAction(
      async (
        { dispatch },
        { isMultiEngineOffMode }: { isMultiEngineOffMode?: boolean }
      ) => {
        await dispatch("LOCK_RELOADING");
        await window.electron.reloadApp({
          isMultiEngineOffMode: !!isMultiEngineOffMode,
        });
      }
    ),
  },

  START_PROGRESS: {
    action({ dispatch }) {
      dispatch("SET_PROGRESS", { progress: 0 });
    },
  },

  SET_PROGRESS: {
    mutation(state, { progress }) {
      state.progress = progress;
    },
    // progressは-1(非表示)と[0, 1]の範囲を取る
    action({ commit }, { progress }) {
      commit("SET_PROGRESS", { progress });
    },
  },

  SET_PROGRESS_FROM_COUNT: {
    action({ commit }, { finishedCount, totalCount }) {
      commit("SET_PROGRESS", { progress: finishedCount / totalCount });
    },
  },

  RESET_PROGRESS: {
    action({ dispatch }) {
      // -1で非表示
      dispatch("SET_PROGRESS", { progress: -1 });
    },
  },
});
