import Mousetrap from "mousetrap";
import { Dark, setCssVar, colors } from "quasar";
import { SettingStoreState, SettingStoreTypes } from "./type";
import { createUILockAction } from "./ui";
import { createPartialStore } from "./vuex";
import { useStore } from "@/store";
import {
  HotkeyAction,
  HotkeyReturnType,
  HotkeySetting,
  SavingSetting,
  ExperimentalSetting,
  ThemeColorType,
  ThemeConf,
  ToolbarSetting,
  EngineId,
  ConfirmedTips,
} from "@/type/preload";

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
  acceptRetrieveTelemetry: "Unconfirmed",
  experimentalSetting: {
    enablePreset: false,
    shouldApplyDefaultPresetOnVoiceChanged: false,
    enableInterrogativeUpspeak: false,
    enableMorphing: false,
    enableMultiEngine: false,
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
};

export const settingStore = createPartialStore<SettingStoreTypes>({
  HYDRATE_SETTING_STORE: {
    async action({ commit, dispatch }) {
      const promises: Promise<unknown>[] = [];

      void window.electron
        .hotkeySettings()
        .then((hotkeys) =>
          hotkeys.map((hotkey) =>
            promises.push(dispatch("SET_HOTKEY_SETTINGS", { data: hotkey }))
          )
        );

      void window.electron.theme().then((theme) => {
        if (theme) {
          commit("SET_THEME_SETTING", {
            currentTheme: theme.currentTheme,
            themes: theme.availableThemes,
          });
          promises.push(
            dispatch("SET_THEME_SETTING", {
              currentTheme: theme.currentTheme,
            })
          );
        }
      });

      void window.electron.getSetting("editorFont").then((editorFont) => {
        promises.push(dispatch("SET_EDITOR_FONT", { editorFont }));
      });

      void window.electron
        .getSetting("showTextLineNumber")
        .then((showTextLineNumber) => {
          promises.push(
            dispatch("SET_SHOW_TEXT_LINE_NUMBER", { showTextLineNumber })
          );
        });

      void window.electron
        .getSetting("acceptRetrieveTelemetry")
        .then((acceptRetrieveTelemetry) => {
          promises.push(
            dispatch("SET_ACCEPT_RETRIEVE_TELEMETRY", {
              acceptRetrieveTelemetry,
            })
          );
        });

      void window.electron.getSetting("acceptTerms").then((acceptTerms) => {
        promises.push(dispatch("SET_ACCEPT_TERMS", { acceptTerms }));
        promises.push(Promise.resolve());
      });

      void window.electron.getSetting("savingSetting").then((savingSetting) => {
        commit("SET_SAVING_SETTING", { savingSetting });
        promises.push(Promise.resolve());
      });

      void window.electron
        .getSetting("toolbarSetting")
        .then((toolbarSetting) => {
          commit("SET_TOOLBAR_SETTING", { toolbarSetting });
          promises.push(Promise.resolve());
        });

      void window.electron
        .getSetting("experimentalSetting")
        .then((experimentalSetting) => {
          commit("SET_EXPERIMENTAL_SETTING", { experimentalSetting });
          promises.push(Promise.resolve());
        });

      void window.electron
        .getSetting("splitTextWhenPaste")
        .then((splitTextWhenPaste) => {
          commit("SET_SPLIT_TEXT_WHEN_PASTE", { splitTextWhenPaste });
          promises.push(Promise.resolve());
        });

      void window.electron
        .getSetting("splitterPosition")
        .then((splitterPosition) => {
          commit("SET_SPLITTER_POSITION", { splitterPosition });
          promises.push(Promise.resolve());
        });

      void window.electron.getSetting("confirmedTips").then((confirmedTips) => {
        commit("SET_CONFIRMED_TIPS", { confirmedTips });
        promises.push(Promise.resolve());
      });

      // FIXME: engineSettingsをMapにする
      void window.electron
        .getSetting("engineSettings")
        .then((engineSettings) => {
          for (const [engineIdStr, engineSetting] of Object.entries(
            engineSettings
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
          promises.push(Promise.resolve());
        });

      await Promise.all(promises);
    },
  },

  SET_SAVING_SETTING: {
    mutation(state, { savingSetting }: { savingSetting: SavingSetting }) {
      state.savingSetting = savingSetting;
    },
    async action({ commit }, { data }: { data: SavingSetting }) {
      const savingSetting = await window.electron.setSetting(
        "savingSetting",
        data
      );
      commit("SET_SAVING_SETTING", { savingSetting });
    },
  },

  SET_HOTKEY_SETTINGS: {
    mutation(state, { newHotkey }: { newHotkey: HotkeySetting }) {
      let flag = true;
      state.hotkeySettings.forEach((hotkey) => {
        if (hotkey.action == newHotkey.action) {
          hotkey.combination = newHotkey.combination;
          flag = false;
        }
      });
      if (flag) state.hotkeySettings.push(newHotkey);
    },
    async action({ state, commit }, { data }: { data: HotkeySetting }) {
      await window.electron.hotkeySettings(data);
      const oldHotkey = state.hotkeySettings.find((value) => {
        return value.action == data.action;
      });
      if (oldHotkey !== undefined) {
        if (oldHotkey.combination != "") {
          Mousetrap.unbind(hotkey2Combo(oldHotkey.combination));
        }
      }
      if (
        data.combination != "" &&
        hotkeyFunctionCache[data.action] !== undefined
      ) {
        Mousetrap.bind(
          hotkey2Combo(data.combination),
          hotkeyFunctionCache[data.action]
        );
      }
      commit("SET_HOTKEY_SETTINGS", {
        newHotkey: data,
      });
    },
  },

  SET_TOOLBAR_SETTING: {
    mutation(state, { toolbarSetting }: { toolbarSetting: ToolbarSetting }) {
      state.toolbarSetting = toolbarSetting;
    },
    async action({ commit }, { data }: { data: ToolbarSetting }) {
      const toolbarSetting = await window.electron.setSetting(
        "toolbarSetting",
        data
      );
      commit("SET_TOOLBAR_SETTING", { toolbarSetting });
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
    async action(
      { state, commit },
      { currentTheme }: { currentTheme: string }
    ) {
      await window.electron.theme(currentTheme);
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

  SET_EDITOR_FONT: {
    mutation(state, { editorFont }) {
      state.editorFont = editorFont;
    },
    async action({ commit }, { editorFont }) {
      await window.electron.setSetting("editorFont", editorFont);
      commit("SET_EDITOR_FONT", { editorFont });
    },
  },

  SET_SHOW_TEXT_LINE_NUMBER: {
    mutation(state, { showTextLineNumber }) {
      state.showTextLineNumber = showTextLineNumber;
    },
    async action({ commit }, { showTextLineNumber }) {
      await window.electron.setSetting(
        "showTextLineNumber",
        showTextLineNumber
      );
      commit("SET_SHOW_TEXT_LINE_NUMBER", {
        showTextLineNumber,
      });
    },
  },

  SET_ACCEPT_RETRIEVE_TELEMETRY: {
    mutation(state, { acceptRetrieveTelemetry }) {
      state.acceptRetrieveTelemetry = acceptRetrieveTelemetry;
    },
    async action({ commit }, { acceptRetrieveTelemetry }) {
      window.dataLayer?.push({
        event: "updateAcceptRetrieveTelemetry",
        acceptRetrieveTelemetry: acceptRetrieveTelemetry == "Accepted",
      });
      await window.electron.setSetting(
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
    async action({ commit }, { acceptTerms }) {
      window.dataLayer?.push({
        event: "updateAcceptTerms",
        acceptTerms: acceptTerms == "Accepted",
      });
      await window.electron.setSetting("acceptTerms", acceptTerms);
      commit("SET_ACCEPT_TERMS", { acceptTerms });
    },
  },

  SET_EXPERIMENTAL_SETTING: {
    mutation(
      state,
      { experimentalSetting }: { experimentalSetting: ExperimentalSetting }
    ) {
      state.experimentalSetting = experimentalSetting;
    },
    async action({ commit }, { experimentalSetting }) {
      await window.electron.setSetting(
        "experimentalSetting",
        experimentalSetting
      );
      commit("SET_EXPERIMENTAL_SETTING", { experimentalSetting });
    },
  },

  SET_SPLIT_TEXT_WHEN_PASTE: {
    mutation(state, { splitTextWhenPaste }) {
      state.splitTextWhenPaste = splitTextWhenPaste;
    },
    async action({ commit }, { splitTextWhenPaste }) {
      await window.electron.setSetting(
        "splitTextWhenPaste",
        splitTextWhenPaste
      );
      commit("SET_SPLIT_TEXT_WHEN_PASTE", { splitTextWhenPaste });
    },
  },

  SET_SPLITTER_POSITION: {
    mutation(state, { splitterPosition }) {
      state.splitterPosition = splitterPosition;
    },
    async action({ commit }, { splitterPosition }) {
      await window.electron.setSetting("splitterPosition", splitterPosition);
      commit("SET_SPLITTER_POSITION", { splitterPosition });
    },
  },

  SET_CONFIRMED_TIPS: {
    mutation(state, { confirmedTips }) {
      state.confirmedTips = confirmedTips;
    },
    async action({ commit }, { confirmedTips }) {
      await window.electron.setSetting("confirmedTips", confirmedTips);
      commit("SET_CONFIRMED_TIPS", { confirmedTips });
    },
  },

  SET_CONFIRMED_TIP: {
    async action({ state, dispatch }, { confirmedTip }) {
      const confirmedTips = {
        ...state.confirmedTips,
        ...confirmedTip,
      };

      await dispatch("SET_CONFIRMED_TIPS", {
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

      await dispatch("SET_CONFIRMED_TIPS", {
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

        await dispatch("SET_ENGINE_SETTING", {
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
  hotkeyMap: Map<HotkeyAction, () => HotkeyReturnType>,
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
        void store.dispatch("SET_HOTKEY_SETTINGS", { data: { ...hotkey } });
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
    if (["Control", "Shift", "Alt", "Meta"].indexOf(event.key) == -1) {
      recordedCombo +=
        event.key.length > 1 ? event.key : event.key.toUpperCase();
    } else {
      recordedCombo = recordedCombo.slice(0, -1);
    }
  }
  return recordedCombo;
};
