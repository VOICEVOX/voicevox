import {
  HotkeyAction,
  HotkeyReturnType,
  HotkeySetting,
  SavingSetting,
} from "@/type/preload";
import {
  SettingGetters,
  SettingActions,
  SettingMutations,
  SettingStoreState,
  VoiceVoxStoreOptions,
} from "./type";
import Mousetrap from "mousetrap";

const hotkeyFunctionCache: Record<string, () => HotkeyReturnType> = {};

export const settingStoreState: SettingStoreState = {
  savingSetting: {
    fileEncoding: "UTF-8",
    fixedExportEnabled: false,
    fixedExportDir: "",
    avoidOverwrite: false,
    exportLab: false,
    exportText: true,
  },
  hotkeySettings: [],
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
    SET_HOTKEY_SETTINGS(
      state,
      { hotkeySettings }: { hotkeySettings: HotkeySetting[] }
    ) {
      if (!state.useUndoRedo) {
        hotkeySettings = hotkeySettings.filter(
          (hotkey) => hotkey.action != "やり直す" && hotkey.action != "元に戻す"
        );
      }
      state.hotkeySettings = hotkeySettings;
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
    GET_HOTKEY_SETTINGS({ commit, dispatch }) {
      const hotkeys = window.electron.hotkeySettings();
      hotkeys.then((value) => {
        commit("SET_HOTKEY_SETTINGS", {
          hotkeySettings: value,
        });
        value.forEach((hotkey) => {
          dispatch("SET_HOTKEY_SETTINGS", { data: hotkey });
        });
      });
    },
    SET_HOTKEY_SETTINGS({ state, commit }, { data }: { data: HotkeySetting }) {
      const hotkeys = window.electron.hotkeySettings(data);
      state.hotkeySettings.forEach((oldData) => {
        if (oldData.action == data.action) {
          // pass the hotkey actions implemented with native js
          if (hotkeyFunctionCache[data.action] !== undefined) {
            if (oldData.combination != "") {
              Mousetrap.unbind(hotkey2Combo(oldData.combination));
            }
            if (data.combination != "") {
              Mousetrap.bind(
                hotkey2Combo(data.combination),
                hotkeyFunctionCache[data.action]
              );
            }
          }
        }
      });
      hotkeys.then((value) => {
        commit("SET_HOTKEY_SETTINGS", {
          hotkeySettings: value,
        });
      });
      return hotkeys;
    },
  },
};

export const setHotkeyFunctions = (
  hotkeyMap: Map<HotkeyAction, () => HotkeyReturnType>,
  hotkeySettings?: HotkeySetting[]
): void => {
  hotkeyMap.forEach((value, key) => {
    hotkeyFunctionCache[key] = value;
  });
  if (hotkeySettings) {
    hotkeySettings.forEach((hotkeySetting) => {
      hotkeyMap.forEach((hotkeyFunction, hotkeyAction) => {
        if (hotkeySetting.action == hotkeyAction) {
          Mousetrap.bind(
            hotkey2Combo(hotkeySetting.combination),
            hotkeyFunction
          );
        }
      });
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
  if (event.key === " ") {
    recordedCombo += "Space";
  } else {
    if (["Control", "Shift", "Alt"].indexOf(event.key) == -1) {
      recordedCombo +=
        event.key.length > 1 ? event.key : event.key.toUpperCase();
    } else {
      recordedCombo = recordedCombo.slice(0, -1);
    }
  }
  return recordedCombo;
};
