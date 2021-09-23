import { HotkeySetting, SavingSetting } from "@/type/preload";
import { StoreOptions } from "vuex";
import { State } from "./type";
import { useStore } from "@/store";
import Mousetrap from "mousetrap";

export const GET_SAVING_SETTING = "GET_SAVING_SETTING";
export const SET_SAVING_SETTING = "SET_SAVING_SETTING";
export const GET_HOTKEY_SETTINGS = "GET_HOTKEY_SETTINGS";
export const SET_HOTKEY_SETTINGS = "SET_HOTKEY_SETTINGS";

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
      const hotkey = window.electron.hotkeySettings();
      hotkey.then((value) => {
        commit(SET_HOTKEY_SETTINGS, {
          hotkeySettings: value,
        });
      });
    },
    [SET_HOTKEY_SETTINGS]: ({ commit }, { data }: { data: HotkeySetting }) => {
      const newHotkeys = window.electron.hotkeySettings(data);
      newHotkeys.then((hotkeySettings) => {
        commit(SET_HOTKEY_SETTINGS, {
          hotkeySettings: hotkeySettings,
        });
      });
    },
  },
} as StoreOptions<State>;

export const watchHotkeys = (
  numIndex: number[],
  actions: (() => any)[]
): void => {
  const store = useStore();
  for (let i = 0; i < numIndex.length; i++) {
    store.watch(
      (state) => {
        return state.hotkeySettings[numIndex[i]];
      },
      (newVal, oldVal) => {
        if (oldVal !== undefined) {
          Mousetrap.unbind(oldVal.combination.toLowerCase().replace(" ", "+"));
        }
        if (newVal.combination != "") {
          Mousetrap.bind(
            newVal.combination.toLowerCase().replace(" ", "+"),
            actions[i]
          );
        }
      }
    );
  }
};
