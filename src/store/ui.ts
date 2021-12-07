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
  isHelpDialogOpen: false,
  isSettingDialogOpen: false,
  isHotkeySettingDialogOpen: false,
  isDefaultStyleSelectDialogOpen: false,
  isAcceptRetrieveTelemetryDialogOpen: false,
  isMaximized: false,
  isPinned: false,
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
      IS_HOTKEY_SETTING_DIALOG_OPEN(state, { isHotkeySettingDialogOpen }) {
        state.isHotkeySettingDialogOpen = isHotkeySettingDialogOpen;
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
    },
  };
