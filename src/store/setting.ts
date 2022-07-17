import {
  HotkeyAction,
  HotkeyReturnType,
  HotkeySetting,
  SavingSetting,
  ExperimentalSetting,
  ThemeColorType,
  ThemeConf,
  ToolbarSetting,
} from "@/type/preload";
import {
  SettingGetters,
  SettingActions,
  SettingMutations,
  SettingStoreState,
  VoiceVoxStoreOptions,
} from "./type";
import Mousetrap from "mousetrap";
import { useStore } from "@/store";
import { Dark, setCssVar, colors } from "quasar";
import { createUILockAction } from "./ui";

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
    outputSamplingRate: 24000,
    audioOutputDevice: "default",
  },
  hotkeySettings: [],
  toolbarSetting: [],
  engineKeys: [],
  engineInfos: {},
  themeSetting: {
    currentTheme: "Default",
    availableThemes: [],
  },
  acceptRetrieveTelemetry: "Unconfirmed",
  experimentalSetting: {
    enablePreset: false,
    enableInterrogativeUpspeak: false,
  },
  splitTextWhenPaste: "PERIOD_AND_NEW_LINE",
  splitterPosition: {
    audioDetailPaneHeight: undefined,
    audioInfoPaneWidth: undefined,
    portraitPaneWidth: undefined,
  },
  confirmedTips: {
    tweakableSliderByScroll: false,
  },
};

export const settingStore: VoiceVoxStoreOptions<
  SettingGetters,
  SettingActions,
  SettingMutations
> = {
  getters: {
    GET_SAVING_SETTING(state) {
      return state.savingSetting;
    },
  },
  mutations: {
    SET_SAVING_SETTING(
      state,
      { savingSetting }: { savingSetting: SavingSetting }
    ) {
      state.savingSetting = savingSetting;
    },
    SET_HOTKEY_SETTINGS(state, { newHotkey }: { newHotkey: HotkeySetting }) {
      let flag = true;
      state.hotkeySettings.forEach((hotkey) => {
        if (hotkey.action == newHotkey.action) {
          hotkey.combination = newHotkey.combination;
          flag = false;
        }
      });
      if (flag) state.hotkeySettings.push(newHotkey);
    },
    SET_TOOLBAR_SETTING(
      state,
      { toolbarSetting }: { toolbarSetting: ToolbarSetting }
    ) {
      state.toolbarSetting = toolbarSetting;
    },
    SET_THEME_SETTING(
      state,
      { currentTheme, themes }: { currentTheme: string; themes?: ThemeConf[] }
    ) {
      if (themes) {
        state.themeSetting.availableThemes = themes;
      }
      state.themeSetting.currentTheme = currentTheme;
    },
    SET_EXPERIMENTAL_SETTING(
      state,
      { experimentalSetting }: { experimentalSetting: ExperimentalSetting }
    ) {
      state.experimentalSetting = experimentalSetting;
    },
    SET_ACCEPT_RETRIEVE_TELEMETRY(state, { acceptRetrieveTelemetry }) {
      state.acceptRetrieveTelemetry = acceptRetrieveTelemetry;
    },
    SET_ACCEPT_TERMS(state, { acceptTerms }) {
      state.acceptTerms = acceptTerms;
    },
    SET_SPLIT_TEXT_WHEN_PASTE(state, { splitTextWhenPaste }) {
      state.splitTextWhenPaste = splitTextWhenPaste;
    },
    SET_SPLITTER_POSITION(state, { splitterPosition }) {
      state.splitterPosition = splitterPosition;
    },
    SET_CONFIRMED_TIPS(state, { confirmedTips }) {
      state.confirmedTips = confirmedTips;
    },
  },
  actions: {
    GET_SAVING_SETTING({ commit }) {
      const newData = window.electron.savingSetting();
      newData.then((savingSetting) => {
        commit("SET_SAVING_SETTING", { savingSetting: savingSetting });
      });
    },
    SET_SAVING_SETTING({ commit }, { data }: { data: SavingSetting }) {
      const newData = window.electron.savingSetting(data);
      newData.then((savingSetting) => {
        commit("SET_SAVING_SETTING", { savingSetting: savingSetting });
      });
    },
    GET_HOTKEY_SETTINGS({ dispatch }) {
      window.electron.hotkeySettings().then((hotkeys) => {
        hotkeys.forEach((hotkey) => {
          dispatch("SET_HOTKEY_SETTINGS", {
            data: hotkey,
          });
        });
      });
    },
    SET_HOTKEY_SETTINGS({ state, commit }, { data }: { data: HotkeySetting }) {
      window.electron.hotkeySettings(data);
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
    GET_TOOLBAR_SETTING({ commit }) {
      const newData = window.electron.toolbarSetting();
      newData.then((toolbarSetting) => {
        commit("SET_TOOLBAR_SETTING", { toolbarSetting });
      });
    },
    SET_TOOLBAR_SETTING({ commit }, { data }: { data: ToolbarSetting }) {
      const newData = window.electron.toolbarSetting(data);
      newData.then((toolbarSetting) => {
        commit("SET_TOOLBAR_SETTING", { toolbarSetting });
      });
    },
    GET_THEME_SETTING({ commit, dispatch }) {
      const currentTheme = window.electron.theme();
      currentTheme.then((value) => {
        if (value) {
          commit("SET_THEME_SETTING", {
            currentTheme: value.currentTheme,
            themes: value.availableThemes,
          });
          dispatch("SET_THEME_SETTING", { currentTheme: value.currentTheme });
        }
      });
    },
    SET_THEME_SETTING(
      { state, commit },
      { currentTheme }: { currentTheme: string }
    ) {
      window.electron.theme(currentTheme);
      const theme = state.themeSetting.availableThemes.find((value) => {
        return value.name == currentTheme;
      });

      if (theme) {
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
      }

      commit("SET_THEME_SETTING", {
        currentTheme: currentTheme,
      });
    },
    GET_ACCEPT_RETRIEVE_TELEMETRY({ dispatch }) {
      window.electron
        .getAcceptRetrieveTelemetry()
        .then((acceptRetrieveTelemetry) =>
          dispatch("SET_ACCEPT_RETRIEVE_TELEMETRY", { acceptRetrieveTelemetry })
        );
    },
    SET_ACCEPT_RETRIEVE_TELEMETRY({ commit }, { acceptRetrieveTelemetry }) {
      window.dataLayer?.push({
        event: "updateAcceptRetrieveTelemetry",
        acceptRetrieveTelemetry: acceptRetrieveTelemetry == "Accepted",
      });
      window.electron.setAcceptRetrieveTelemetry(acceptRetrieveTelemetry);
      commit("SET_ACCEPT_RETRIEVE_TELEMETRY", { acceptRetrieveTelemetry });
    },
    GET_ACCEPT_TERMS({ dispatch }) {
      window.electron
        .getAcceptTerms()
        .then((acceptTerms) => dispatch("SET_ACCEPT_TERMS", { acceptTerms }));
    },
    SET_ACCEPT_TERMS({ commit }, { acceptTerms }) {
      window.dataLayer?.push({
        event: "updateAcceptTerms",
        acceptTerms: acceptTerms == "Accepted",
      });
      window.electron.setAcceptTerms(acceptTerms);
      commit("SET_ACCEPT_TERMS", { acceptTerms });
    },
    GET_EXPERIMENTAL_SETTING({ dispatch }) {
      window.electron.getExperimentalSetting().then((experimentalSetting) => {
        dispatch("SET_EXPERIMENTAL_SETTING", { experimentalSetting });
      });
    },
    SET_EXPERIMENTAL_SETTING({ commit }, { experimentalSetting }) {
      window.electron.setExperimentalSetting(experimentalSetting);
      commit("SET_EXPERIMENTAL_SETTING", { experimentalSetting });
    },
    INIT_SPLIT_TEXT_WHEN_PASTE({ dispatch }) {
      window.electron.getSplitTextWhenPaste().then((v) => {
        dispatch("SET_SPLIT_TEXT_WHEN_PASTE", { splitTextWhenPaste: v });
      });
    },
    SET_SPLIT_TEXT_WHEN_PASTE({ commit }, { splitTextWhenPaste }) {
      window.electron.setSplitTextWhenPaste(splitTextWhenPaste);
      commit("SET_SPLIT_TEXT_WHEN_PASTE", { splitTextWhenPaste });
    },
    GET_SPLITTER_POSITION({ dispatch }) {
      window.electron.getSplitterPosition().then((splitterPosition) => {
        dispatch("SET_SPLITTER_POSITION", { splitterPosition });
      });
    },
    SET_SPLITTER_POSITION({ commit }, { splitterPosition }) {
      window.electron.setSplitterPosition(splitterPosition);
      commit("SET_SPLITTER_POSITION", { splitterPosition });
    },
    GET_CONFIRMED_TIPS({ dispatch }) {
      window.electron.getSetting("confirmedTips").then((confirmedTips) => {
        dispatch("SET_CONFIRMED_TIPS", { confirmedTips });
      });
    },
    SET_CONFIRMED_TIPS({ commit }, { confirmedTips }) {
      window.electron.setSetting("confirmedTips", confirmedTips);
      commit("SET_CONFIRMED_TIPS", { confirmedTips });
    },

    /**
     * CPU/GPUモードを切り替えようとする。
     * GPUモードでエンジン起動に失敗した場合はCPUモードに戻す。
     */
    CHANGE_USE_GPU: createUILockAction(
      async ({ state, dispatch }, { useGpu }) => {
        if (state.useGpu === useGpu) return;

        const isAvailableGPUMode = await window.electron.isAvailableGPUMode();

        // 対応するGPUがない場合に変更を続行するか問う
        if (useGpu && !isAvailableGPUMode) {
          const result = await window.electron.showQuestionDialog({
            type: "warning",
            title: "対応するGPUデバイスが見つかりません",
            message:
              "GPUモードの利用には、メモリが3GB以上あるNVIDIA製GPUが必要です。\n" +
              "このままGPUモードに変更するとエンジンエラーが発生する可能性があります。本当に変更しますか？",
            buttons: ["変更する", "変更しない"],
            cancelId: 1,
          });
          if (result == 1) {
            return;
          }
        }

        const engineKey: string | undefined = state.engineKeys[0]; // TODO: 複数エンジン対応
        if (engineKey === undefined)
          throw new Error(`No such engine registered: index == 0`);

        await dispatch("SET_USE_GPU", { useGpu });
        const success = await dispatch("RESTART_ENGINE", { engineKey });

        // GPUモードに変更できなかった場合はCPUモードに戻す
        // FIXME: useGpu設定を保存してからエンジン起動を試すのではなく、逆にしたい
        if (!success && useGpu) {
          await window.electron.showMessageDialog({
            type: "error",
            title: "GPUモードに変更できませんでした",
            message:
              "GPUモードでエンジンを起動できなかったためCPUモードに戻します",
          });
          await dispatch("CHANGE_USE_GPU", { useGpu: false });
          return;
        }
      }
    ),
  },
};

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
    if (["Control", "Shift", "Alt", "Meta"].indexOf(event.key) == -1) {
      recordedCombo +=
        event.key.length > 1 ? event.key : event.key.toUpperCase();
    } else {
      recordedCombo = recordedCombo.slice(0, -1);
    }
  }
  return recordedCombo;
};
