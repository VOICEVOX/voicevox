import { SettingStoreState, SettingStoreTypes } from "./type";
import { createUILockAction } from "./ui";
import { createPartialStore } from "./vuex";
import { themes } from "@/domain/theme";
import {
  hideAllLoadingScreen,
  showAlertDialog,
  showLoadingScreen,
  showQuestionDialog,
} from "@/components/Dialog/Dialog";
import {
  SavingSetting,
  ExperimentalSettingType,
  ToolbarSettingType,
  EngineId,
  ConfirmedTips,
  RootMiscSettingType,
} from "@/type/preload";
import { IsEqual } from "@/type/utility";
import { HotkeySettingType } from "@/domain/hotkeyAction";

export const settingStoreState: SettingStoreState = {
  openedEditor: undefined,
  savingSetting: {
    fileEncoding: "UTF-8",
    fileNamePattern: "",
    fixedExportEnabled: false,
    fixedExportDir: "",
    avoidOverwrite: false,
    exportLab: false,
    exportText: false,
    outputStereo: false,
    audioOutputDevice: "default",
    songTrackFileNamePattern: "",
  },
  hotkeySettings: [],
  toolbarSetting: [],
  engineIds: [],
  engineInfos: {},
  engineManifests: {},
  currentTheme: "Default",
  availableThemes: [],
  editorFont: "default",
  showTextLineNumber: false,
  showAddAudioItemButton: true,
  acceptTerms: "Unconfirmed",
  acceptRetrieveTelemetry: "Unconfirmed",
  experimentalSetting: {
    enableInterrogativeUpspeak: false,
    enableMorphing: false,
    enableMultiSelect: false,
    shouldKeepTuningOnTextChange: false,
    showParameterPanel: false,
  },
  splitTextWhenPaste: "PERIOD_AND_NEW_LINE",
  splitterPosition: {
    audioDetailPaneHeight: undefined,
    audioInfoPaneWidth: undefined,
    portraitPaneWidth: undefined,
  },
  confirmedTips: {
    tweakableSliderByScroll: false,
    engineStartedOnAltPort: false,
    notifyOnGenerate: false,
  },
  engineSettings: {},
  enablePreset: false,
  shouldApplyDefaultPresetOnVoiceChanged: false,
  enableMultiEngine: false,
  enableMemoNotation: false,
  enableRubyNotation: false,
  undoableTrackOperations: {
    soloAndMute: true,
    panAndGain: true,
  },
  showSingCharacterPortrait: true,
  playheadPositionDisplayFormat: "MINUTES_SECONDS",
};

export const settingStore = createPartialStore<SettingStoreTypes>({
  HYDRATE_SETTING_STORE: {
    async action({ mutations, actions }) {
      void window.backend.hotkeySettings().then((hotkeys) => {
        hotkeys.forEach((hotkey) => {
          void actions.SET_HOTKEY_SETTINGS({
            data: hotkey,
          });
        });
      });

      mutations.SET_AVAILABLE_THEMES({
        themes,
      });
      void actions.SET_CURRENT_THEME_SETTING({
        currentTheme: await window.backend.getSetting("currentTheme"),
      });

      void actions.SET_ACCEPT_RETRIEVE_TELEMETRY({
        acceptRetrieveTelemetry: await window.backend.getSetting(
          "acceptRetrieveTelemetry",
        ),
      });

      void actions.SET_ACCEPT_TERMS({
        acceptTerms: await window.backend.getSetting("acceptTerms"),
      });

      mutations.SET_SAVING_SETTING({
        savingSetting: await window.backend.getSetting("savingSetting"),
      });

      mutations.SET_TOOLBAR_SETTING({
        toolbarSetting: await window.backend.getSetting("toolbarSetting"),
      });

      mutations.SET_EXPERIMENTAL_SETTING({
        experimentalSetting: await window.backend.getSetting(
          "experimentalSetting",
        ),
      });

      mutations.SET_CONFIRMED_TIPS({
        confirmedTips: await window.backend.getSetting("confirmedTips"),
      });

      // FIXME: engineSettingsをMapにする
      for (const [engineIdStr, engineSetting] of Object.entries(
        await window.backend.getSetting("engineSettings"),
      )) {
        if (engineSetting == undefined)
          throw new Error(
            `engineSetting is undefined. engineIdStr: ${engineIdStr}`,
          );
        mutations.SET_ENGINE_SETTING({
          engineId: EngineId(engineIdStr),
          engineSetting,
        });
      }

      const rootMiscSettingKeys = [
        "editorFont",
        "showTextLineNumber",
        "showAddAudioItemButton",
        "splitTextWhenPaste",
        "splitterPosition",
        "enablePreset",
        "shouldApplyDefaultPresetOnVoiceChanged",
        "enableMultiEngine",
        "enableRubyNotation",
        "enableMemoNotation",
        "skipUpdateVersion",
        "undoableTrackOperations",
        "showSingCharacterPortrait",
        "playheadPositionDisplayFormat",
        "openedEditor",
      ] as const;

      // rootMiscSettingKeysに値を足し忘れていたときに型エラーを出す検出用コード
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: IsEqual<
        keyof RootMiscSettingType,
        (typeof rootMiscSettingKeys)[number]
      > = true;

      for (const key of rootMiscSettingKeys) {
        mutations.SET_ROOT_MISC_SETTING({
          // Vuexの型処理でUnionが解かれてしまうのを迂回している
          // FIXME: このワークアラウンドをなくす
          key: key as never,
          value: await window.backend.getSetting(key),
        });
      }
    },
  },

  SET_SAVING_SETTING: {
    mutation(state, { savingSetting }: { savingSetting: SavingSetting }) {
      state.savingSetting = savingSetting;
    },
    action({ mutations }, { data }: { data: SavingSetting }) {
      const newData = window.backend.setSetting("savingSetting", data);
      void newData.then((savingSetting) => {
        mutations.SET_SAVING_SETTING({ savingSetting });
      });
    },
  },

  SET_HOTKEY_SETTINGS: {
    mutation(state, { newHotkey }: { newHotkey: HotkeySettingType }) {
      let flag = true;
      state.hotkeySettings.forEach((hotkey) => {
        if (hotkey.action == newHotkey.action) {
          hotkey.combination = newHotkey.combination;
          flag = false;
        }
      });
      if (flag) state.hotkeySettings.push(newHotkey);
    },
    action({ mutations }, { data }: { data: HotkeySettingType }) {
      void window.backend.hotkeySettings(data);
      mutations.SET_HOTKEY_SETTINGS({
        newHotkey: data,
      });
    },
  },

  SET_TOOLBAR_SETTING: {
    mutation(
      state,
      { toolbarSetting }: { toolbarSetting: ToolbarSettingType },
    ) {
      state.toolbarSetting = toolbarSetting;
    },
    action({ mutations }, { data }: { data: ToolbarSettingType }) {
      const newData = window.backend.setSetting("toolbarSetting", data);
      void newData.then((toolbarSetting) => {
        mutations.SET_TOOLBAR_SETTING({ toolbarSetting });
      });
    },
  },

  SET_ROOT_MISC_SETTING: {
    mutation(state, { key, value }) {
      // @ts-expect-error Vuexの型処理でUnionが解かれてしまうのを迂回している
      // FIXME: このワークアラウンドをなくす
      state[key] = value;
    },
    action({ mutations }, { key, value }) {
      void window.backend.setSetting(key, value);
      // @ts-expect-error Vuexの型処理でUnionが解かれてしまうのを迂回している
      // FIXME: このワークアラウンドをなくす
      mutations.SET_ROOT_MISC_SETTING({ key, value });
    },
  },

  SET_CURRENT_THEME_SETTING: {
    mutation(state, { currentTheme }: { currentTheme: string }) {
      state.currentTheme = currentTheme;
    },
    action({ state, mutations }, { currentTheme }: { currentTheme: string }) {
      void window.backend.setSetting("currentTheme", currentTheme);
      const theme = state.availableThemes.find((value) => {
        return value.name == currentTheme;
      });

      if (theme == undefined) {
        throw Error("Theme not found");
      }

      window.backend.setNativeTheme(theme.isDark ? "dark" : "light");

      mutations.SET_CURRENT_THEME_SETTING({
        currentTheme: currentTheme,
      });
    },
  },

  SET_ACCEPT_RETRIEVE_TELEMETRY: {
    mutation(state, { acceptRetrieveTelemetry }) {
      state.acceptRetrieveTelemetry = acceptRetrieveTelemetry;
    },
    action({ mutations }, { acceptRetrieveTelemetry }) {
      window.dataLayer?.push({
        event: "updateAcceptRetrieveTelemetry",
        acceptRetrieveTelemetry: acceptRetrieveTelemetry == "Accepted",
      });
      void window.backend.setSetting(
        "acceptRetrieveTelemetry",
        acceptRetrieveTelemetry,
      );
      mutations.SET_ACCEPT_RETRIEVE_TELEMETRY({ acceptRetrieveTelemetry });
    },
  },

  SET_ACCEPT_TERMS: {
    mutation(state, { acceptTerms }) {
      state.acceptTerms = acceptTerms;
    },
    action({ mutations }, { acceptTerms }) {
      window.dataLayer?.push({
        event: "updateAcceptTerms",
        acceptTerms: acceptTerms == "Accepted",
      });
      void window.backend.setSetting("acceptTerms", acceptTerms);
      mutations.SET_ACCEPT_TERMS({ acceptTerms });
    },
  },

  SET_EXPERIMENTAL_SETTING: {
    mutation(
      state,
      { experimentalSetting }: { experimentalSetting: ExperimentalSettingType },
    ) {
      state.experimentalSetting = experimentalSetting;
    },
    action({ mutations }, { experimentalSetting }) {
      void window.backend.setSetting(
        "experimentalSetting",
        experimentalSetting,
      );
      mutations.SET_EXPERIMENTAL_SETTING({ experimentalSetting });
    },
  },

  SET_CONFIRMED_TIPS: {
    mutation(state, { confirmedTips }) {
      state.confirmedTips = confirmedTips;
    },
    action({ mutations }, { confirmedTips }) {
      void window.backend.setSetting("confirmedTips", confirmedTips);
      mutations.SET_CONFIRMED_TIPS({ confirmedTips });
    },
  },

  SET_CONFIRMED_TIP: {
    action({ state, actions }, { confirmedTip }) {
      const confirmedTips = {
        ...state.confirmedTips,
        ...confirmedTip,
      };

      void actions.SET_CONFIRMED_TIPS({
        confirmedTips: confirmedTips as ConfirmedTips,
      });
    },
  },

  RESET_CONFIRMED_TIPS: {
    async action({ state, actions }) {
      const confirmedTips: Record<string, boolean> = {
        ...state.confirmedTips,
      };

      // 全てのヒントを未確認にする
      for (const key in confirmedTips) {
        confirmedTips[key] = false;
      }

      void actions.SET_CONFIRMED_TIPS({
        confirmedTips: confirmedTips as ConfirmedTips,
      });
    },
  },

  SET_ENGINE_SETTING: {
    mutation(state, { engineSetting, engineId }) {
      state.engineSettings[engineId] = engineSetting;
    },
    async action({ mutations }, { engineSetting, engineId }) {
      await window.backend.setEngineSetting(engineId, engineSetting);
      mutations.SET_ENGINE_SETTING({ engineSetting, engineId });
    },
  },

  CHANGE_USE_GPU: {
    /**
     * CPU/GPUモードを切り替えようとする。
     * GPUモードでエンジン起動に失敗した場合はCPUモードに戻す。
     */
    action: createUILockAction(
      async ({ state, actions }, { useGpu, engineId }) => {
        // 対応するGPUがない場合に変更を続行するか問う
        if (useGpu) {
          showLoadingScreen({ message: "GPUデバイスを確認中です" });

          const isAvailableGPUMode = await window.backend.isAvailableGPUMode();

          hideAllLoadingScreen();

          if (!isAvailableGPUMode) {
            const result = await showQuestionDialog({
              type: "warning",
              title: "対応するGPUデバイスが見つかりません",
              message:
                "GPUモードの利用には対応するGPUデバイスが必要です。\n" +
                "このままGPUモードに変更するとエンジンエラーが発生する可能性があります。本当に変更しますか？",
              buttons: ["変更しない", "変更する"],
              cancel: 0,
            });
            if (result == 0) {
              return;
            }
          }
        }

        showLoadingScreen({
          message: "起動モードを変更中です",
        });

        void actions.SET_ENGINE_SETTING({
          engineSetting: { ...state.engineSettings[engineId], useGpu },
          engineId,
        });
        const result = await actions.RESTART_ENGINES({
          engineIds: [engineId],
        });

        hideAllLoadingScreen();

        // GPUモードに変更できなかった場合はCPUモードに戻す
        // FIXME: useGpu設定を保存してからエンジン起動を試すのではなく、逆にしたい
        if (!result.success && useGpu) {
          await showAlertDialog({
            title: "GPUモードに変更できませんでした",
            message:
              "GPUモードでエンジンを起動できなかったためCPUモードに戻します",
          });
          await actions.CHANGE_USE_GPU({ useGpu: false, engineId });
          return;
        }
      },
    ),
  },

  GET_RECENTLY_USED_PROJECTS: {
    async action() {
      return await window.backend.getSetting("recentlyUsedProjects");
    },
  },

  APPEND_RECENTLY_USED_PROJECT: {
    async action({ actions }, { filePath }) {
      const recentlyUsedProjects = await actions.GET_RECENTLY_USED_PROJECTS();
      const newRecentlyUsedProjects = [
        filePath,
        ...recentlyUsedProjects.filter((value) => value != filePath),
      ].slice(0, 10);
      await window.backend.setSetting(
        "recentlyUsedProjects",
        newRecentlyUsedProjects,
      );
    },
  },
});
