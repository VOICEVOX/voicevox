import { Action, ActionContext, ActionsBase } from "./vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  UiStoreState,
  UiStoreTypes,
} from "./type";
import { ActivePointScrollMode, EngineInfo } from "@/type/preload";
import { EngineManifest } from "@/openapi";
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

  IS_HELP_DIALOG_OPEN: {
    mutation(state, { isHelpDialogOpen }: { isHelpDialogOpen: boolean }) {
      state.isHelpDialogOpen = isHelpDialogOpen;
    },
    action(
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
  },

  IS_SETTING_DIALOG_OPEN: {
    mutation(state, { isSettingDialogOpen }: { isSettingDialogOpen: boolean }) {
      state.isSettingDialogOpen = isSettingDialogOpen;
    },
    action(
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
  },

  IS_HOTKEY_SETTING_DIALOG_OPEN: {
    mutation(state, { isHotkeySettingDialogOpen }) {
      state.isHotkeySettingDialogOpen = isHotkeySettingDialogOpen;
    },
    action({ state, commit }, { isHotkeySettingDialogOpen }) {
      if (state.isHotkeySettingDialogOpen === isHotkeySettingDialogOpen) return;

      if (isHotkeySettingDialogOpen) {
        commit("LOCK_UI");
        commit("LOCK_MENUBAR");
      } else {
        commit("UNLOCK_UI");
        commit("UNLOCK_MENUBAR");
      }

      commit("IS_HOTKEY_SETTING_DIALOG_OPEN", { isHotkeySettingDialogOpen });
    },
  },

  IS_TOOLBAR_SETTING_DIALOG_OPEN: {
    mutation(
      state,
      { isToolbarSettingDialogOpen }: { isToolbarSettingDialogOpen: boolean }
    ) {
      state.isToolbarSettingDialogOpen = isToolbarSettingDialogOpen;
    },
    action(
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
  },

  IS_ACCEPT_RETRIEVE_TELEMETRY_DIALOG_OPEN: {
    mutation(state, { isAcceptRetrieveTelemetryDialogOpen }) {
      state.isAcceptRetrieveTelemetryDialogOpen =
        isAcceptRetrieveTelemetryDialogOpen;
    },
    async action({ state, commit }, { isAcceptRetrieveTelemetryDialogOpen }) {
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
  },

  IS_ACCEPT_TERMS_DIALOG_OPEN: {
    mutation(state, { isAcceptTermsDialogOpen }) {
      state.isAcceptTermsDialogOpen = isAcceptTermsDialogOpen;
    },
    async action({ state, commit }, { isAcceptTermsDialogOpen }) {
      if (state.isAcceptTerms_DialogOpen === isAcceptTermsDialogOpen) return;

      if (isAcceptTermsDialogOpen) commit("LOCK_UI");
      else commit("UNLOCK_UI");

      commit("IS_ACCEPT_TERMS_DIALOG_OPEN", {
        isAcceptTermsDialogOpen,
      });
    },
  },

  IS_ENGINE_MANAGE_DIALOG_OPEN: {
    mutation(
      state,
      { isEngineManageDialogOpen }: { isEngineManageDialogOpen: boolean }
    ) {
      state.isEngineManageDialogOpen = isEngineManageDialogOpen;
    },
    async action({ state, commit }, { isEngineManageDialogOpen }) {
      if (state.isEngineManageDialogOpen === isEngineManageDialogOpen) return;

      if (isEngineManageDialogOpen) {
        commit("LOCK_UI");
        commit("LOCK_MENUBAR");
      } else {
        commit("UNLOCK_UI");
        commit("UNLOCK_MENUBAR");
      }

      commit("IS_ENGINE_MANAGE_DIALOG_OPEN", {
        isEngineManageDialogOpen,
      });
    },
  },

  IS_DICTIONARY_MANAGE_DIALOG_OPEN: {
    mutation(
      state,
      {
        isDictionaryManageDialogOpen,
      }: { isDictionaryManageDialogOpen: boolean }
    ) {
      state.isDictionaryManageDialogOpen = isDictionaryManageDialogOpen;
    },
    async action({ state, commit }, { isDictionaryManageDialogOpen }) {
      if (state.isDictionaryManageDialogOpen === isDictionaryManageDialogOpen)
        return;

      if (isDictionaryManageDialogOpen) {
        commit("LOCK_UI");
        commit("LOCK_MENUBAR");
      } else {
        commit("UNLOCK_UI");
        commit("UNLOCK_MENUBAR");
      }

      commit("IS_DICTIONARY_MANAGE_DIALOG_OPEN", {
        isDictionaryManageDialogOpen,
      });
    },
  },

  ON_VUEX_READY: {
    action() {
      window.electron.vuexReady();
    },
  },

  IS_CHARACTER_ORDER_DIALOG_OPEN: {
    mutation(
      state,
      { isCharacterOrderDialogOpen }: { isCharacterOrderDialogOpen: boolean }
    ) {
      state.isCharacterOrderDialogOpen = isCharacterOrderDialogOpen;
    },
    async action({ state, commit }, { isCharacterOrderDialogOpen }) {
      if (state.isCharacterOrderDialogOpen === isCharacterOrderDialogOpen)
        return;

      if (isCharacterOrderDialogOpen) {
        commit("LOCK_UI");
        commit("LOCK_MENUBAR");
      } else {
        commit("UNLOCK_UI");
        commit("UNLOCK_MENUBAR");
      }

      commit("IS_CHARACTER_ORDER_DIALOG_OPEN", {
        isCharacterOrderDialogOpen,
      });
    },
  },

  IS_DEFAULT_STYLE_SELECT_DIALOG_OPEN: {
    mutation(
      state,
      {
        isDefaultStyleSelectDialogOpen,
      }: { isDefaultStyleSelectDialogOpen: boolean }
    ) {
      state.isDefaultStyleSelectDialogOpen = isDefaultStyleSelectDialogOpen;
    },
    async action({ state, commit }, { isDefaultStyleSelectDialogOpen }) {
      if (
        state.isDefaultStyleSelectDialogOpen === isDefaultStyleSelectDialogOpen
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

  GET_ENGINE_INFOS: {
    async action({ commit }) {
      commit("SET_ENGINE_INFOS", {
        engineInfos: await window.electron.engineInfos(),
      });
    },
  },

  SET_ENGINE_INFOS: {
    mutation(state, { engineInfos }: { engineInfos: EngineInfo[] }) {
      if (state.isSafeMode) {
        state.engineIds = engineInfos
          .filter((engineInfo) => engineInfo.type === "main")
          .map((info) => info.uuid);
      } else {
        state.engineIds = engineInfos.map((engineInfo) => engineInfo.uuid);
      }
      state.engineInfos = Object.fromEntries(
        engineInfos.map((engineInfo) => [engineInfo.uuid, engineInfo])
      );
      state.engineStates = Object.fromEntries(
        engineInfos.map((engineInfo) => [engineInfo.uuid, "STARTING"])
      );
    },
  },

  SET_ENGINE_MANIFESTS: {
    mutation(
      state,
      { engineManifests }: { engineManifests: Record<string, EngineManifest> }
    ) {
      state.engineManifests = engineManifests;
    },
  },

  FETCH_AND_SET_ENGINE_MANIFESTS: {
    async action({ state, commit }) {
      commit("SET_ENGINE_MANIFESTS", {
        engineManifests: Object.fromEntries(
          await Promise.all(
            state.engineIds.map(
              async (engineId) =>
                await this.dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
                  engineId,
                }).then(async (instance) => [
                  engineId,
                  await instance.invoke("engineManifestEngineManifestGet")({}),
                ])
            )
          )
        ),
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
      window.electron.restartApp({ isSafeMode: !!safeMode });
    },
  },
});
