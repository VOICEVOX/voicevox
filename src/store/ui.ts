import {
  ActionsBase,
  DotNotationAction,
  DotNotationActionContext,
  DotNotationDispatch,
} from "./vuex";
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
  MessageDialogOptions,
  ConfirmDialogOptions,
  WarningDialogOptions,
  NotifyAndNotShowAgainButtonOption,
  connectAndExportTextWithDialog,
  generateAndConnectAndSaveAudioWithDialog,
  generateAndSaveOneAudioWithDialog,
  multiGenerateAndSaveAudioWithDialog,
  showAlertDialog,
  showConfirmDialog,
  showNotifyAndNotShowAgainButton,
  showWarningDialog,
} from "@/components/Dialog/Dialog";
import { objectEntries } from "@/helpers/typedEntries";

export function createUILockAction<S, A extends ActionsBase, K extends keyof A>(
  action: (
    context: DotNotationActionContext<
      S,
      S,
      AllGetters,
      AllActions,
      AllMutations
    >,
    payload: Parameters<A[K]>[0],
  ) => ReturnType<A[K]> extends Promise<unknown>
    ? ReturnType<A[K]>
    : Promise<ReturnType<A[K]>>,
): DotNotationAction<S, S, A, K, AllGetters, AllActions, AllMutations> {
  return (context, payload: Parameters<A[K]>[0]) => {
    context.mutations.LOCK_UI();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return action(context, payload).finally(() => {
      context.mutations.UNLOCK_UI();
    });
  };
}

export function withProgress<T>(
  action: Promise<T>,
  actions: DotNotationDispatch<AllActions>,
): Promise<T> {
  void actions.START_PROGRESS();
  return action.finally(() => actions.RESET_PROGRESS());
}

export const uiStoreState: UiStoreState = {
  uiLockCount: 0,
  dialogLockCount: 0,
  reloadingLock: false,
  inheritAudioInfo: true,
  activePointScrollMode: "OFF",
  isSettingDialogOpen: false,
  isHotkeySettingDialogOpen: false,
  isToolbarSettingDialogOpen: false,
  isCharacterOrderDialogOpen: false,
  isDefaultStyleSelectDialogOpen: false,
  isAcceptRetrieveTelemetryDialogOpen: false,
  isAcceptTermsDialogOpen: false,
  isDictionaryManageDialogOpen: false,
  isEngineManageDialogOpen: false,
  isUpdateNotificationDialogOpen: false,
  isExportSongAudioDialogOpen: false,
  isImportSongProjectDialogOpen: false,
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
      },
    ),
  },

  LOCK_UI: {
    mutation(state) {
      state.uiLockCount++;
    },
    action({ mutations }) {
      mutations.LOCK_UI();
    },
  },

  UNLOCK_UI: {
    mutation(state) {
      if (state.uiLockCount !== 0) {
        state.uiLockCount--;
      } else {
        // eslint-disable-next-line no-console
        window.backend.logWarn(
          "UNLOCK_UI is called when state.uiLockCount == 0",
        );
      }
    },
    action({ mutations }) {
      mutations.UNLOCK_UI();
    },
  },

  LOCK_MENUBAR: {
    mutation(state) {
      state.dialogLockCount++;
    },
    action({ mutations }) {
      mutations.LOCK_MENUBAR();
    },
  },

  UNLOCK_MENUBAR: {
    mutation(state) {
      state.dialogLockCount--;
    },
    action({ mutations }) {
      mutations.UNLOCK_MENUBAR();
    },
  },

  /**
   * 再読み込み中。UNLOCKされることはない。
   */
  LOCK_RELOADING: {
    mutation(state) {
      state.reloadingLock = true;
    },
    action({ mutations }) {
      mutations.LOCK_RELOADING();
    },
  },

  SHOULD_SHOW_PANES: {
    getter(_, getters) {
      return getters.ACTIVE_AUDIO_KEY != undefined;
    },
  },

  SET_DIALOG_OPEN: {
    mutation(state, dialogState) {
      for (const [key, value] of objectEntries(dialogState)) {
        if (!(key in state)) {
          throw new Error(`Unknown dialog state: ${key}`);
        }
        if (value == undefined) {
          throw new Error(`Invalid dialog state: ${key}`);
        }
        state[key] = value;
      }
    },
    async action({ state, mutations }, dialogState) {
      for (const [key, value] of objectEntries(dialogState)) {
        if (state[key] === value) continue;

        if (value) {
          mutations.LOCK_UI();
          mutations.LOCK_MENUBAR();
        } else {
          mutations.UNLOCK_UI();
          mutations.UNLOCK_MENUBAR();
        }
      }

      mutations.SET_DIALOG_OPEN(dialogState);
    },
  },

  SHOW_ALERT_DIALOG: {
    action: createUILockAction(async (_, payload: MessageDialogOptions) => {
      return await showAlertDialog(payload);
    }),
  },

  SHOW_CONFIRM_DIALOG: {
    action: createUILockAction(async (_, payload: ConfirmDialogOptions) => {
      return await showConfirmDialog(payload);
    }),
  },

  SHOW_WARNING_DIALOG: {
    action: createUILockAction(async (_, payload: WarningDialogOptions) => {
      return await showWarningDialog(payload);
    }),
  },

  SHOW_NOTIFY_AND_NOT_SHOW_AGAIN_BUTTON: {
    action({ actions }, payload: NotifyAndNotShowAgainButtonOption) {
      showNotifyAndNotShowAgainButton({ actions }, payload);
    },
  },

  HYDRATE_UI_STORE: {
    async action({ mutations }) {
      mutations.SET_INHERIT_AUDIOINFO({
        inheritAudioInfo: await window.backend.getSetting("inheritAudioInfo"),
      });

      mutations.SET_ACTIVE_POINT_SCROLL_MODE({
        activePointScrollMode: await window.backend.getSetting(
          "activePointScrollMode",
        ),
      });

      // electron-window-stateがvuex初期化前に働くので
      // ここで改めてelectron windowの最大化状態をVuex storeに同期
      if (await window.backend.isMaximizedWindow()) {
        mutations.DETECT_MAXIMIZED();
      }
    },
  },

  ON_VUEX_READY: {
    mutation(state) {
      state.isVuexReady = true;
    },
    action({ mutations }) {
      window.backend.vuexReady();
      mutations.ON_VUEX_READY();
    },
  },

  // Vuexが準備できるまで待つ
  WAIT_VUEX_READY: {
    async action({ state }, { timeout }) {
      if (state.isVuexReady) return;

      let vuexReadyTimeout = 0;
      while (!state.isVuexReady) {
        if (vuexReadyTimeout >= timeout) {
          throw new Error("Vuexが準備できませんでした");
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
        vuexReadyTimeout += 300;
      }
    },
  },

  SET_INHERIT_AUDIOINFO: {
    mutation(state, { inheritAudioInfo }: { inheritAudioInfo: boolean }) {
      state.inheritAudioInfo = inheritAudioInfo;
    },
    async action(
      { mutations },
      { inheritAudioInfo }: { inheritAudioInfo: boolean },
    ) {
      mutations.SET_INHERIT_AUDIOINFO({
        inheritAudioInfo: await window.backend.setSetting(
          "inheritAudioInfo",
          inheritAudioInfo,
        ),
      });
    },
  },

  SET_ACTIVE_POINT_SCROLL_MODE: {
    mutation(
      state,
      {
        activePointScrollMode,
      }: { activePointScrollMode: ActivePointScrollMode },
    ) {
      state.activePointScrollMode = activePointScrollMode;
    },
    async action(
      { mutations },
      {
        activePointScrollMode,
      }: { activePointScrollMode: ActivePointScrollMode },
    ) {
      mutations.SET_ACTIVE_POINT_SCROLL_MODE({
        activePointScrollMode: await window.backend.setSetting(
          "activePointScrollMode",
          activePointScrollMode,
        ),
      });
    },
  },

  /**
   * 選択可能なテーマをセットする。
   * NOTE: カスタムテーマが導入された場合を見越して残している。
   */
  SET_AVAILABLE_THEMES: {
    mutation(state, { themes }) {
      state.availableThemes = themes;
    },
  },

  DETECT_UNMAXIMIZED: {
    mutation(state) {
      state.isMaximized = false;
    },
    action({ mutations }) {
      mutations.DETECT_UNMAXIMIZED();
    },
  },

  DETECT_MAXIMIZED: {
    mutation(state) {
      state.isMaximized = true;
    },
    action({ mutations }) {
      mutations.DETECT_MAXIMIZED();
    },
  },

  DETECT_PINNED: {
    mutation(state) {
      state.isPinned = true;
    },
    action({ mutations }) {
      mutations.DETECT_PINNED();
    },
  },

  DETECT_UNPINNED: {
    mutation(state) {
      state.isPinned = false;
    },
    action({ mutations }) {
      mutations.DETECT_UNPINNED();
    },
  },

  DETECT_ENTER_FULLSCREEN: {
    mutation(state) {
      state.isFullscreen = true;
    },
    action({ mutations }) {
      mutations.DETECT_ENTER_FULLSCREEN();
    },
  },

  DETECT_LEAVE_FULLSCREEN: {
    mutation(state) {
      state.isFullscreen = false;
    },
    action({ mutations }) {
      mutations.DETECT_LEAVE_FULLSCREEN();
    },
  },

  IS_FULLSCREEN: {
    getter(state) {
      return state.isFullscreen;
    },
  },

  /** UIの拡大 */
  ZOOM_IN: {
    action() {
      window.backend.zoomIn();
    },
  },

  /** UIの縮小 */
  ZOOM_OUT: {
    action() {
      window.backend.zoomOut();
    },
  },

  /** UIの拡大率のリセット */
  ZOOM_RESET: {
    action() {
      window.backend.zoomReset();
    },
  },

  CHECK_EDITED_AND_NOT_SAVE: {
    /**
     * プロジェクトファイル未保存の場合、保存するかどうかを確認する。
     * 保存後にウィンドウを閉じるか、アプリを再読み込みする。
     * 保存がキャンセルされた場合は何もしない。
     */
    async action({ actions, getters }, obj) {
      await actions.SING_STOP_AUDIO(); // FIXME: ON_BEFORE_QUITTINGなどを作成して移動すべき

      if (getters.IS_EDITED) {
        const result = await actions.SAVE_OR_DISCARD_PROJECT_FILE({});
        if (result == "canceled") {
          return;
        }
      }

      await actions.STOP_RENDERING(); // FIXME: FINISH_VUEXなどを作成して移動すべき

      if (obj.closeOrReload == "close") {
        window.backend.closeWindow();
      } else if (obj.closeOrReload == "reload") {
        await actions.RELOAD_APP({
          isMultiEngineOffMode: obj.isMultiEngineOffMode,
        });
      }
    },
  },

  RELOAD_APP: {
    action: createUILockAction(
      async (
        { actions },
        { isMultiEngineOffMode }: { isMultiEngineOffMode?: boolean },
      ) => {
        await actions.LOCK_RELOADING();
        await window.backend.reloadApp({
          isMultiEngineOffMode: !!isMultiEngineOffMode,
        });
      },
    ),
  },

  START_PROGRESS: {
    action({ actions }) {
      void actions.SET_PROGRESS({ progress: 0 });
    },
  },

  SET_PROGRESS: {
    mutation(state, { progress }) {
      state.progress = progress;
    },
    // progressは-1(非表示)と[0, 1]の範囲を取る
    action({ mutations }, { progress }) {
      mutations.SET_PROGRESS({ progress });
    },
  },

  SET_PROGRESS_FROM_COUNT: {
    action({ mutations }, { finishedCount, totalCount }) {
      mutations.SET_PROGRESS({ progress: finishedCount / totalCount });
    },
  },

  RESET_PROGRESS: {
    action({ actions }) {
      // -1で非表示
      void actions.SET_PROGRESS({ progress: -1 });
    },
  },

  // TODO: この4つのアクションをVue側に移動したい
  SHOW_GENERATE_AND_SAVE_ALL_AUDIO_DIALOG: {
    async action({ state, actions }) {
      await multiGenerateAndSaveAudioWithDialog({
        audioKeys: state.audioKeys,
        disableNotifyOnGenerate: state.confirmedTips.notifyOnGenerate,
        actions,
      });
    },
  },

  SHOW_GENERATE_AND_CONNECT_ALL_AUDIO_DIALOG: {
    async action({ actions, state }) {
      await generateAndConnectAndSaveAudioWithDialog({
        actions,
        disableNotifyOnGenerate: state.confirmedTips.notifyOnGenerate,
      });
    },
  },

  SHOW_GENERATE_AND_SAVE_SELECTED_AUDIO_DIALOG: {
    async action({ getters, actions, state }) {
      const activeAudioKey = getters.ACTIVE_AUDIO_KEY;
      if (activeAudioKey == undefined) {
        void actions.SHOW_ALERT_DIALOG({
          title: "テキスト欄が選択されていません",
          message: "音声を書き出したいテキスト欄を選択してください。",
        });
        return;
      }

      const selectedAudioKeys = getters.SELECTED_AUDIO_KEYS;
      if (
        state.experimentalSetting.enableMultiSelect &&
        selectedAudioKeys.length > 1
      ) {
        await multiGenerateAndSaveAudioWithDialog({
          audioKeys: selectedAudioKeys,
          actions: actions,
          disableNotifyOnGenerate: state.confirmedTips.notifyOnGenerate,
        });
      } else {
        await generateAndSaveOneAudioWithDialog({
          audioKey: activeAudioKey,
          disableNotifyOnGenerate: state.confirmedTips.notifyOnGenerate,
          actions: actions,
        });
      }
    },
  },

  SHOW_CONNECT_AND_EXPORT_TEXT_DIALOG: {
    async action({ actions, state }) {
      await connectAndExportTextWithDialog({
        actions,
        disableNotifyOnGenerate: state.confirmedTips.notifyOnGenerate,
      });
    },
  },
});
