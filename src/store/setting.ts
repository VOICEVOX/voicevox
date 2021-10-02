import { HotkeyAction, HotkeySetting, SavingSetting } from "@/type/preload";
import { StoreOptions } from "vuex";
import { State } from "./type";
import Mousetrap from "mousetrap";

export const GET_SAVING_SETTING = "GET_SAVING_SETTING";
export const SET_SAVING_SETTING = "SET_SAVING_SETTING";
export const GET_HOTKEY_SETTINGS = "GET_HOTKEY_SETTINGS";
export const SET_HOTKEY_SETTINGS = "SET_HOTKEY_SETTINGS";

const hotkeyFunctionCache: Record<string, () => any> = {};

export const settingStore = {
  getters: {
    [GET_SAVING_SETTING](state) {
      return state.savingSetting;
    },
    [GET_HOTKEY_SETTINGS](state) {
      return state.hotkeySettings;
    },
  },
  mutations: {
    [SET_SAVING_SETTING](
      state,
      { savingSetting }: { savingSetting: SavingSetting }
    ) {
      state.savingSetting = savingSetting;
    },
    [SET_HOTKEY_SETTINGS](
      state,
      { hotkeySettings }: { hotkeySettings: HotkeySetting[] }
    ) {
      state.hotkeySettings = hotkeySettings;
    },
  },
  actions: {
    [GET_SAVING_SETTING]: ({ commit }) => {
      const newData = window.electron.savingSetting();
      newData.then((savingSetting) => {
        commit(SET_SAVING_SETTING, { savingSetting: savingSetting });
      });
    },
    [SET_SAVING_SETTING]: ({ commit }, { data }: { data: SavingSetting }) => {
      const newData = window.electron.savingSetting(data);
      newData.then((savingSetting) => {
        commit(SET_SAVING_SETTING, { savingSetting: savingSetting });
      });
    },
    [GET_HOTKEY_SETTINGS]: ({ commit }) => {
      const hotkeys = window.electron.hotkeySettings();
      hotkeys.then((value) => {
        value.forEach((item) => {
          if (hotkeyFunctionCache[item.action]) {
            Mousetrap.bind(
              hotkey2Combo(item.combination),
              hotkeyFunctionCache[item.action]
            );
          }
        });
        commit(SET_HOTKEY_SETTINGS, {
          hotkeySettings: value,
        });
      });
    },
    [SET_HOTKEY_SETTINGS]: (
      { state, commit },
      { data }: { data: HotkeySetting }
    ) => {
      const hotkeys = window.electron.hotkeySettings(data);
      state.hotkeySettings.forEach((item) => {
        if (item.action == data.action) {
          Mousetrap.unbind(hotkey2Combo(item.combination));
          Mousetrap.bind(
            hotkey2Combo(data.combination),
            hotkeyFunctionCache[data.action]
          );
        }
      });
      hotkeys.then((value) => {
        commit(SET_HOTKEY_SETTINGS, {
          hotkeySettings: value,
        });
      });
      return hotkeys;
    },
  },
} as StoreOptions<State>;

export const setHotkeyFunctions = (
  actionKeys: HotkeyAction[],
  hotkeyActionFunctions: (() => any)[]
): void => {
  for (let i = 0; i < actionKeys.length; i++) {
    hotkeyFunctionCache[actionKeys[i]] = hotkeyActionFunctions[i];
  }
};

const hotkey2Combo = (hotkeyCombo: string) => {
  return hotkeyCombo.toLowerCase().replace(" ", "+");
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
    recordedCombo += event.key.length > 1 ? event.key : event.key.toUpperCase();
  }
  return recordedCombo;
};
