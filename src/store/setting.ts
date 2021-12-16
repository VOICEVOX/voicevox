import {
  HotkeyAction,
  HotkeyReturnType,
  HotkeySetting,
  SavingSetting,
  ThemeColorType,
  ThemeConf,
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
import { Dark, setCssVar, colors, Platform } from "quasar";

const hotkeyFunctionCache: Record<string, () => HotkeyReturnType> = {};

export const settingStoreState: SettingStoreState = {
  savingSetting: {
    fileEncoding: "UTF-8",
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
  engineHost: process.env.VUE_APP_ENGINE_URL as unknown as string,
  themeSetting: {
    currentTheme: "Default",
    availableThemes: [],
  },
  acceptRetrieveTelemetry: "Unconfirmed",
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
    SET_THEME_SETTING(
      state,
      { currentTheme, themes }: { currentTheme: string; themes?: ThemeConf[] }
    ) {
      if (themes) {
        state.themeSetting.availableThemes = themes;
      }
      state.themeSetting.currentTheme = currentTheme;
    },
    SET_ACCEPT_RETRIEVE_TELEMETRY(state, { acceptRetrieveTelemetry }) {
      state.acceptRetrieveTelemetry = acceptRetrieveTelemetry;
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
  // Mac の場合のみ Meta キーを修飾キーとして取り扱う
  if (Platform.is.mac) {
    if (event.metaKey) {
      recordedCombo += "Meta ";
    }
  }
  if (event.key === " ") {
    recordedCombo += "Space";
  } else {
    const modifierKeys = ["Control", "Shift", "Alt"];
    if (Platform.is.mac) {
      modifierKeys.push("Meta");
    }
    if (modifierKeys.indexOf(event.key) == -1) {
      recordedCombo +=
        event.key.length > 1 ? event.key : event.key.toUpperCase();
    } else {
      recordedCombo = recordedCombo.slice(0, -1);
    }
  }
  return recordedCombo;
};
