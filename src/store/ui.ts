import { Action, ActionContext, ActionsBase } from "./vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  UiActions,
  UiGetters,
  UiMutations,
  UiStoreState,
  VoiceVoxStoreOptions,
} from "./type";
import { ActivePointScrollMode } from "@/type/preload";

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
  isUpdateCheckDialogOpen: false,
  isHotkeySettingDialogOpen: false,
  isToolbarSettingDialogOpen: false,
  isDefaultStyleSelectDialogOpen: false,
  isAcceptRetrieveTelemetryDialogOpen: false,
  isAcceptTermsDialogOpen: false,
  isMaximized: false,
  isPinned: false,
  isFullscreen: false,
  isAutoUpdateCheck: false,
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
      IS_FULLSCREEN(state) {
        return state.isFullscreen;
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
      IS_UPDATE_CHECK_DIALOG_OPEN(
        state,
        { isUpdateCheckDialogOpen }: { isUpdateCheckDialogOpen: boolean }
      ) {
        state.isUpdateCheckDialogOpen = isUpdateCheckDialogOpen;
      },
      IS_HOTKEY_SETTING_DIALOG_OPEN(state, { isHotkeySettingDialogOpen }) {
        state.isHotkeySettingDialogOpen = isHotkeySettingDialogOpen;
      },
      IS_TOOLBAR_SETTING_DIALOG_OPEN(
        state,
        { isToolbarSettingDialogOpen }: { isToolbarSettingDialogOpen: boolean }
      ) {
        state.isToolbarSettingDialogOpen = isToolbarSettingDialogOpen;
      },
      IS_DEFAULT_STYLE_SELECT_DIALOG_OPEN(
        state,
        {
          isDefaultStyleSelectDialogOpen,
        }: { isDefaultStyleSelectDialogOpen: boolean }
      ) {
        state.isDefaultStyleSelectDialogOpen = isDefaultStyleSelectDialogOpen;
      },
      IS_ACCEPT_RETRIEVE_TELEMETRY_DIALOG_OPEN(
        state,
        { isAcceptRetrieveTelemetryDialogOpen }
      ) {
        state.isAcceptRetrieveTelemetryDialogOpen =
          isAcceptRetrieveTelemetryDialogOpen;
      },
      IS_ACCEPT_TERMS_DIALOG_OPEN(state, { isAcceptTermsDialogOpen }) {
        state.isAcceptTermsDialogOpen = isAcceptTermsDialogOpen;
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
      SET_ACTIVE_POINT_SCROLL_MODE(
        state,
        {
          activePointScrollMode,
        }: { activePointScrollMode: ActivePointScrollMode }
      ) {
        state.activePointScrollMode = activePointScrollMode;
      },
      SET_IS_AUTO_UPDATE_CHECK(
        state,
        { isAutoUpdateCheck }: { isAutoUpdateCheck: boolean }
      ) {
        state.isAutoUpdateCheck = isAutoUpdateCheck;
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
      DETECT_ENTER_FULLSCREEN(state) {
        state.isFullscreen = true;
      },
      DETECT_LEAVE_FULLSCREEN(state) {
        state.isFullscreen = false;
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
      IS_HELP_DIALOG_OPEN(
        { state, commit },
        { isHelpDialogOpen }: { isHelpDialogOpen: boolean }
      ) {
        if (state.isHelpDialogOpen === isHelpDialogOpen) return;

        if (isHelpDialogOpen) {
          commit("LOCK_UI");
          commit("LOCK_MENUBAR");
        } else {
          commit("UNLOCK_UI");
          commit("UNLOCK_MENUBAR");
        }

        commit("IS_HELP_DIALOG_OPEN", { isHelpDialogOpen });
      },
      IS_SETTING_DIALOG_OPEN(
        { state, commit },
        { isSettingDialogOpen }: { isSettingDialogOpen: boolean }
      ) {
        if (state.isSettingDialogOpen === isSettingDialogOpen) return;

        if (isSettingDialogOpen) {
          commit("LOCK_UI");
          commit("LOCK_MENUBAR");
        } else {
          commit("UNLOCK_UI");
          commit("UNLOCK_MENUBAR");
        }

        commit("IS_SETTING_DIALOG_OPEN", { isSettingDialogOpen });
      },
      async IS_UPDATE_CHECK_DIALOG_OPEN(
        { state, commit },
        { isUpdateCheckDialogOpen }: { isUpdateCheckDialogOpen: boolean }
      ) {
        if (state.isUpdateCheckDialogOpen === isUpdateCheckDialogOpen) return;

        if (isUpdateCheckDialogOpen) {
          commit("LOCK_UI");
          commit("LOCK_MENUBAR");

          const result: number = await window.electron.showInfoDialog({
            title: "アップデートチェック",
            message: "アップデートチェックを行います。\nよろしいですか？",
            buttons: ["はい", "いいえ"],
          });
          commit("UNLOCK_UI");
          commit("UNLOCK_MENUBAR");
          if (result == 1) {
            return;
          }
          window.electron.updateCheck();
        }
      },
      IS_HOTKEY_SETTING_DIALOG_OPEN(
        { state, commit },
        { isHotkeySettingDialogOpen }
      ) {
        if (state.isHotkeySettingDialogOpen === isHotkeySettingDialogOpen)
          return;

        if (isHotkeySettingDialogOpen) {
          commit("LOCK_UI");
          commit("LOCK_MENUBAR");
        } else {
          commit("UNLOCK_UI");
          commit("UNLOCK_MENUBAR");
        }

        commit("IS_HOTKEY_SETTING_DIALOG_OPEN", { isHotkeySettingDialogOpen });
      },
      IS_TOOLBAR_SETTING_DIALOG_OPEN(
        { state, commit },
        { isToolbarSettingDialogOpen }: { isToolbarSettingDialogOpen: boolean }
      ) {
        if (state.isToolbarSettingDialogOpen === isToolbarSettingDialogOpen)
          return;

        if (isToolbarSettingDialogOpen) {
          commit("LOCK_UI");
          commit("LOCK_MENUBAR");
        } else {
          commit("UNLOCK_UI");
          commit("UNLOCK_MENUBAR");
        }

        commit("IS_TOOLBAR_SETTING_DIALOG_OPEN", {
          isToolbarSettingDialogOpen,
        });
      },
      ON_VUEX_READY() {
        window.electron.vuexReady();
      },
      async IS_DEFAULT_STYLE_SELECT_DIALOG_OPEN(
        { state, commit },
        { isDefaultStyleSelectDialogOpen }
      ) {
        if (
          state.isDefaultStyleSelectDialogOpen ===
          isDefaultStyleSelectDialogOpen
        )
          return;

        if (isDefaultStyleSelectDialogOpen) {
          commit("LOCK_UI");
          commit("LOCK_MENUBAR");
        } else {
          commit("UNLOCK_UI");
          commit("UNLOCK_MENUBAR");
        }

        commit("IS_DEFAULT_STYLE_SELECT_DIALOG_OPEN", {
          isDefaultStyleSelectDialogOpen,
        });
      },
      async IS_ACCEPT_RETRIEVE_TELEMETRY_DIALOG_OPEN(
        { state, commit },
        { isAcceptRetrieveTelemetryDialogOpen }
      ) {
        if (
          state.isAcceptRetrieveTelemetryDialogOpen ===
          isAcceptRetrieveTelemetryDialogOpen
        )
          return;

        if (isAcceptRetrieveTelemetryDialogOpen) commit("LOCK_UI");
        else commit("UNLOCK_UI");

        commit("IS_ACCEPT_RETRIEVE_TELEMETRY_DIALOG_OPEN", {
          isAcceptRetrieveTelemetryDialogOpen,
        });
      },
      async IS_ACCEPT_TERMS_DIALOG_OPEN(
        { state, commit },
        { isAcceptTermsDialogOpen }
      ) {
        if (state.isAcceptTerms_DialogOpen === isAcceptTermsDialogOpen) return;

        if (isAcceptTermsDialogOpen) commit("LOCK_UI");
        else commit("UNLOCK_UI");

        commit("IS_ACCEPT_TERMS_DIALOG_OPEN", {
          isAcceptTermsDialogOpen,
        });
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
      async SET_IS_AUTO_UPDATE_CHECK(
        { commit },
        { isAutoUpdateCheck }: { isAutoUpdateCheck: boolean }
      ) {
        commit("SET_IS_AUTO_UPDATE_CHECK", {
          isAutoUpdateCheck: await window.electron.isAutoUpdateCheck(
            isAutoUpdateCheck
          ),
        });
      },
      async GET_ACTIVE_POINT_SCROLL_MODE({ commit }) {
        commit("SET_ACTIVE_POINT_SCROLL_MODE", {
          activePointScrollMode: await window.electron.activePointScrollMode(),
        });
      },
      async SET_ACTIVE_POINT_SCROLL_MODE(
        { commit },
        {
          activePointScrollMode,
        }: { activePointScrollMode: ActivePointScrollMode }
      ) {
        commit("SET_ACTIVE_POINT_SCROLL_MODE", {
          activePointScrollMode: await window.electron.activePointScrollMode(
            activePointScrollMode
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
      async DETECT_ENTER_FULLSCREEN({ commit }) {
        commit("DETECT_ENTER_FULLSCREEN");
      },
      async DETECT_LEAVE_FULLSCREEN({ commit }) {
        commit("DETECT_LEAVE_FULLSCREEN");
      },
      async CHECK_EDITED_AND_NOT_SAVE({ getters }) {
        if (getters.IS_EDITED) {
          const result: number = await window.electron.showInfoDialog({
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
  };
