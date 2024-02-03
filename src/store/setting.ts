import { Dark, setCssVar, colors } from "quasar";
import { SettingStoreState, SettingStoreTypes } from "./type";
import { createUILockAction } from "./ui";
import { createPartialStore } from "./vuex";
import { useStore } from "@/store";
import {
  HotkeyActionType,
  HotkeyReturnType,
  HotkeySettingType,
  SavingSetting,
  ExperimentalSettingType,
  ThemeColorType,
  ThemeConf,
  ToolbarSettingType,
  EngineId,
  ConfirmedTips,
  RootMiscSettingType,
} from "@/type/preload";
import { IsEqual } from "@/type/utility";

const hotkeyFunctionCache: Record<string, () => HotkeyReturnType> = {};

export const settingStoreState: SettingStoreState = {
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
  },
  hotkeySettings: [],
  toolbarSetting: [],
  engineIds: [],
  engineInfos: {},
  engineManifests: {},
  themeSetting: {
    currentTheme: "Default",
    availableThemes: [],
  },
  editorFont: "default",
  showTextLineNumber: false,
  showAddAudioItemButton: true,
  acceptTerms: "Unconfirmed",
  acceptRetrieveTelemetry: "Unconfirmed",
  experimentalSetting: {
    enablePreset: false,
    shouldApplyDefaultPresetOnVoiceChanged: false,
    enableInterrogativeUpspeak: false,
    enableMorphing: false,
    enableMultiSelect: false,
    shouldKeepTuningOnTextChange: false,
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
  enableMultiEngine: false,
  enableMemoNotation: false,
  enableRubyNotation: false,
};

export const settingStore = createPartialStore<SettingStoreTypes>({
  HYDRATE_SETTING_STORE: {
    async action({ commit, dispatch }) {
      window.electron.hotkeySettings().then((hotkeys) => {
        hotkeys.forEach((hotkey) => {
          dispatch("SET_HOTKEY_SETTINGS", {
            data: hotkey,
          });
        });
      });

      const theme = await window.electron.theme();
      if (theme) {
        commit("SET_THEME_SETTING", {
          currentTheme: theme.currentTheme,
          themes: theme.availableThemes,
        });
        dispatch("SET_THEME_SETTING", {
          currentTheme: theme.currentTheme,
        });
      }

      dispatch("SET_ACCEPT_RETRIEVE_TELEMETRY", {
        acceptRetrieveTelemetry: await window.electron.getSetting(
          "acceptRetrieveTelemetry"
        ),
      });

      dispatch("SET_ACCEPT_TERMS", {
        acceptTerms: await window.electron.getSetting("acceptTerms"),
      });

      commit("SET_SAVING_SETTING", {
        savingSetting: await window.electron.getSetting("savingSetting"),
      });

      commit("SET_TOOLBAR_SETTING", {
        toolbarSetting: await window.electron.getSetting("toolbarSetting"),
      });

      commit("SET_EXPERIMENTAL_SETTING", {
        experimentalSetting: await window.electron.getSetting(
          "experimentalSetting"
        ),
      });

      commit("SET_CONFIRMED_TIPS", {
        confirmedTips: await window.electron.getSetting("confirmedTips"),
      });

      // FIXME: engineSettingsをMapにする
      for (const [engineIdStr, engineSetting] of Object.entries(
        await window.electron.getSetting("engineSettings")
      )) {
        if (engineSetting == undefined)
          throw new Error(
            `engineSetting is undefined. engineIdStr: ${engineIdStr}`
          );
        commit("SET_ENGINE_SETTING", {
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
        "enableMultiEngine",
        "enableRubyNotation",
        "enableMemoNotation",
        "skipUpdateVersion",
      ] as const;

      // rootMiscSettingKeysに値を足し忘れていたときに型エラーを出す検出用コード
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: IsEqual<
        keyof RootMiscSettingType,
        typeof rootMiscSettingKeys[number]
      > = true;

      for (const key of rootMiscSettingKeys) {
        commit("SET_ROOT_MISC_SETTING", {
          // Vuexの型処理でUnionが解かれてしまうのを迂回している
          // FIXME: このワークアラウンドをなくす
          key: key as never,
          value: await window.electron.getSetting(key),
        });
      }
    },
  },

  SET_SAVING_SETTING: {
    mutation(state, { savingSetting }: { savingSetting: SavingSetting }) {
      state.savingSetting = savingSetting;
    },
    action({ commit }, { data }: { data: SavingSetting }) {
      const newData = window.electron.setSetting("savingSetting", data);
      newData.then((savingSetting) => {
        commit("SET_SAVING_SETTING", { savingSetting });
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
    action({ commit }, { data }: { data: HotkeySettingType }) {
      window.electron.hotkeySettings(data);
      commit("SET_HOTKEY_SETTINGS", {
        newHotkey: data,
      });
    },
  },

  SET_TOOLBAR_SETTING: {
    mutation(
      state,
      { toolbarSetting }: { toolbarSetting: ToolbarSettingType }
    ) {
      state.toolbarSetting = toolbarSetting;
    },
    action({ commit }, { data }: { data: ToolbarSettingType }) {
      const newData = window.electron.setSetting("toolbarSetting", data);
      newData.then((toolbarSetting) => {
        commit("SET_TOOLBAR_SETTING", { toolbarSetting });
      });
    },
  },

  SET_ROOT_MISC_SETTING: {
    mutation(state, { key, value }) {
      // Vuexの型処理でUnionが解かれてしまうのを迂回している
      // FIXME: このワークアラウンドをなくす
      state[key as never] = value;
    },
    action({ commit }, { key, value }) {
      window.electron.setSetting(key, value);
      // Vuexの型処理でUnionが解かれてしまうのを迂回している
      // FIXME: このワークアラウンドをなくす
      commit("SET_ROOT_MISC_SETTING", { key: key as never, value });
    },
  },

  SET_THEME_SETTING: {
    mutation(
      state,
      { currentTheme, themes }: { currentTheme: string; themes?: ThemeConf[] }
    ) {
      if (themes) {
        state.themeSetting.availableThemes = themes;
      }
      state.themeSetting.currentTheme = currentTheme;
    },
    action({ state, commit }, { currentTheme }: { currentTheme: string }) {
      window.electron.theme(currentTheme);
      const theme = state.themeSetting.availableThemes.find((value) => {
        return value.name == currentTheme;
      });

      if (theme == undefined) {
        throw Error("Theme not found");
      }

      for (const key in theme.colors) {
        const color = theme.colors[key as ThemeColorType];
        const { r, g, b } = colors.hexToRgb(color);
        document.documentElement.style.setProperty(`--color-${key}`, color);
        document.documentElement.style.setProperty(
          `--color-${key}-rgb`,
          `${r}, ${g}, ${b}`
        );
      }
      const mixColors: ThemeColorType[][] = [
        ["primary", "background"],
        ["warning", "background"],
      ];
      for (const [color1, color2] of mixColors) {
        const color1Rgb = colors.hexToRgb(theme.colors[color1]);
        const color2Rgb = colors.hexToRgb(theme.colors[color2]);
        const r = Math.trunc((color1Rgb.r + color2Rgb.r) / 2);
        const g = Math.trunc((color1Rgb.g + color2Rgb.g) / 2);
        const b = Math.trunc((color1Rgb.b + color2Rgb.b) / 2);
        const propertyName = `--color-mix-${color1}-${color2}-rgb`;
        const cssColor = `${r}, ${g}, ${b}`;
        document.documentElement.style.setProperty(propertyName, cssColor);
      }
      Dark.set(theme.isDark);
      setCssVar("primary", theme.colors["primary"]);
      setCssVar("warning", theme.colors["warning"]);

      document.documentElement.setAttribute(
        "is-dark-theme",
        theme.isDark ? "true" : "false"
      );

      window.electron.setNativeTheme(theme.isDark ? "dark" : "light");

      commit("SET_THEME_SETTING", {
        currentTheme: currentTheme,
      });
    },
  },

  SET_ACCEPT_RETRIEVE_TELEMETRY: {
    mutation(state, { acceptRetrieveTelemetry }) {
      state.acceptRetrieveTelemetry = acceptRetrieveTelemetry;
    },
    action({ commit }, { acceptRetrieveTelemetry }) {
      window.dataLayer?.push({
        event: "updateAcceptRetrieveTelemetry",
        acceptRetrieveTelemetry: acceptRetrieveTelemetry == "Accepted",
      });
      window.electron.setSetting(
        "acceptRetrieveTelemetry",
        acceptRetrieveTelemetry
      );
      commit("SET_ACCEPT_RETRIEVE_TELEMETRY", { acceptRetrieveTelemetry });
    },
  },

  SET_ACCEPT_TERMS: {
    mutation(state, { acceptTerms }) {
      state.acceptTerms = acceptTerms;
    },
    action({ commit }, { acceptTerms }) {
      window.dataLayer?.push({
        event: "updateAcceptTerms",
        acceptTerms: acceptTerms == "Accepted",
      });
      window.electron.setSetting("acceptTerms", acceptTerms);
      commit("SET_ACCEPT_TERMS", { acceptTerms });
    },
  },

  SET_EXPERIMENTAL_SETTING: {
    mutation(
      state,
      { experimentalSetting }: { experimentalSetting: ExperimentalSettingType }
    ) {
      state.experimentalSetting = experimentalSetting;
    },
    action({ commit }, { experimentalSetting }) {
      window.electron.setSetting("experimentalSetting", experimentalSetting);
      commit("SET_EXPERIMENTAL_SETTING", { experimentalSetting });
    },
  },

  SET_CONFIRMED_TIPS: {
    mutation(state, { confirmedTips }) {
      state.confirmedTips = confirmedTips;
    },
    action({ commit }, { confirmedTips }) {
      window.electron.setSetting("confirmedTips", confirmedTips);
      commit("SET_CONFIRMED_TIPS", { confirmedTips });
    },
  },

  SET_CONFIRMED_TIP: {
    action({ state, dispatch }, { confirmedTip }) {
      const confirmedTips = {
        ...state.confirmedTips,
        ...confirmedTip,
      };

      dispatch("SET_CONFIRMED_TIPS", {
        confirmedTips: confirmedTips as ConfirmedTips,
      });
    },
  },

  RESET_CONFIRMED_TIPS: {
    async action({ state, dispatch }) {
      const confirmedTips: { [key: string]: boolean } = {
        ...state.confirmedTips,
      };

      // 全てのヒントを未確認にする
      for (const key in confirmedTips) {
        confirmedTips[key] = false;
      }

      dispatch("SET_CONFIRMED_TIPS", {
        confirmedTips: confirmedTips as ConfirmedTips,
      });
    },
  },

  SET_ENGINE_SETTING: {
    mutation(state, { engineSetting, engineId }) {
      state.engineSettings[engineId] = engineSetting;
    },
    async action({ commit }, { engineSetting, engineId }) {
      await window.electron.setEngineSetting(engineId, engineSetting);
      commit("SET_ENGINE_SETTING", { engineSetting, engineId });
    },
  },

  CHANGE_USE_GPU: {
    /**
     * CPU/GPUモードを切り替えようとする。
     * GPUモードでエンジン起動に失敗した場合はCPUモードに戻す。
     */
    action: createUILockAction(
      async ({ state, dispatch }, { useGpu, engineId }) => {
        const isAvailableGPUMode = await window.electron.isAvailableGPUMode();

        // 対応するGPUがない場合に変更を続行するか問う
        if (useGpu && !isAvailableGPUMode) {
          const result = await window.electron.showQuestionDialog({
            type: "warning",
            title: "対応するGPUデバイスが見つかりません",
            message:
              "GPUモードの利用には対応するGPUデバイスが必要です。\n" +
              "このままGPUモードに変更するとエンジンエラーが発生する可能性があります。本当に変更しますか？",
            buttons: ["変更する", "変更しない"],
            cancelId: 1,
          });
          if (result == 1) {
            return;
          }
        }

        dispatch("SET_ENGINE_SETTING", {
          engineSetting: { ...state.engineSettings[engineId], useGpu },
          engineId,
        });
        const result = await dispatch("RESTART_ENGINES", {
          engineIds: [engineId],
        });

        // GPUモードに変更できなかった場合はCPUモードに戻す
        // FIXME: useGpu設定を保存してからエンジン起動を試すのではなく、逆にしたい
        if (!result.success && useGpu) {
          await window.electron.showMessageDialog({
            type: "error",
            title: "GPUモードに変更できませんでした",
            message:
              "GPUモードでエンジンを起動できなかったためCPUモードに戻します",
          });
          await dispatch("CHANGE_USE_GPU", { useGpu: false, engineId });
          return;
        }
      }
    ),
  },

  GET_RECENTLY_USED_PROJECTS: {
    async action() {
      return await window.electron.getSetting("recentlyUsedProjects");
    },
  },

  APPEND_RECENTLY_USED_PROJECT: {
    async action({ dispatch }, { filePath }) {
      const recentlyUsedProjects = await dispatch("GET_RECENTLY_USED_PROJECTS");
      const newRecentlyUsedProjects = [
        filePath,
        ...recentlyUsedProjects.filter((value) => value != filePath),
      ].slice(0, 10);
      await window.electron.setSetting(
        "recentlyUsedProjects",
        newRecentlyUsedProjects
      );
    },
  },
});

export const setHotkeyFunctions = (
  hotkeyMap: Map<HotkeyActionType, () => HotkeyReturnType>,
  reassign?: boolean
): void => {
  hotkeyMap.forEach((value, key) => {
    hotkeyFunctionCache[key] = value;
  });
  if (reassign) {
    const store = useStore();
    hotkeyMap.forEach((hotkeyFunction, hotkeyAction) => {
      const hotkey = store.state.hotkeySettings.find((value) => {
        return value.action == hotkeyAction;
      });
      if (hotkey) {
        store.dispatch("SET_HOTKEY_SETTINGS", { data: { ...hotkey } });
      }
    });
  }
};

const hotkey2Combo = (hotkeyCombo: string) => {
  return hotkeyCombo.toLowerCase().replaceAll(" ", "+");
};

export const parseCombo = (event: KeyboardEvent): string => {
  let recordedCombo = "";
  if (event.ctrlKey) {
    recordedCombo += "Ctrl ";
  }
  if (event.altKey) {
    recordedCombo += "Alt ";
  }
  if (event.shiftKey) {
    recordedCombo += "Shift ";
  }
  // event.metaKey は Mac キーボードでは Cmd キー、Windows キーボードでは Windows キーの押下で true になる
  if (event.metaKey) {
    recordedCombo += "Meta ";
  }
  if (event.key === " ") {
    recordedCombo += "Space";
  } else {
    if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
      recordedCombo = recordedCombo.slice(0, -1);
    } else {
      recordedCombo +=
        event.key.length > 1 ? event.key : event.key.toUpperCase();
    }
  }
  return recordedCombo;
};
