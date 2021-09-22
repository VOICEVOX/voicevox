import { HotkeySetting, SavingSetting } from "@/type/preload";
import { StoreOptions } from "vuex";
import { State } from "./type";

export const GET_SAVING_SETTING_DATA = "GET_SAVING_SETTING_DATA";
export const SET_SAVING_SETTING_DATA = "SET_SAVING_SETTING_DATA";
export const GET_HOTKEY_SETTINGS = "GET_HOTKEY_SETTINGS";
export const SET_HOTKEY_SETTINGS = "SET_HOTKEY_SETTINGS";

export const settingStore = {
  getters: {
    [GET_SAVING_SETTING_DATA](state) {
      return state.savingSetting;
    },
    [GET_HOTKEY_SETTINGS](state) {
      return state.hotkeySettings;
    },
  },
  mutations: {
    [SET_SAVING_SETTING_DATA](
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
    [GET_SAVING_SETTING_DATA]: ({ commit }) => {
      const newData = window.electron.savingSetting();
      newData.then((savingSetting) => {
        commit(SET_SAVING_SETTING_DATA, { savingSetting: savingSetting });
      });
    },
    [SET_SAVING_SETTING_DATA]: (
      { commit },
      { data }: { data: SavingSetting }
    ) => {
      const newData = window.electron.savingSetting(data);
      newData.then((savingSetting) => {
        commit(SET_SAVING_SETTING_DATA, { savingSetting: savingSetting });
      });
    },
    [GET_HOTKEY_SETTINGS]: ({ commit }) => {
      const hotkey = window.electron.hotkeySettings();
      hotkey.then((value) => {
        console.log(value);
        commit(SET_HOTKEY_SETTINGS, {
          hotkeySettings: value,
        });
      });
    },
    [SET_HOTKEY_SETTINGS]: (
      { commit },
      { data }: { data: HotkeySetting[] }
    ) => {
      const newHotkeys = window.electron.hotkeySettings(data);
      newHotkeys.then((hotkeySettings) => {
        commit(SET_HOTKEY_SETTINGS, {
          hotkeySettings: hotkeySettings,
        });
      });
    },
  },
} as StoreOptions<State>;
