import { StoreOptions } from "vuex";
import { HotkeySetting, State } from "./type";
import { createUILockAction } from "./ui";

export const GET_HOTKEY_SETTING = "GET_HOTKEY_SETTING";
export const SET_HOTKEY_SETTING = "SET_HOTKEY_SETTING";
export const GET_SIMPLE_MODE_DATA = "GET_SIMPLE_MODE_DATA";
export const SET_SIMPLE_MODE_DATA = "SET_SIMPLE_MODE_DATA";
export const OPEN_FILE_EXPLORE = "OPEN_FILE_EXPLORE";
export const RESET_SETTING = "RESET_SETTING";

export const SAVE_SETTING = "SAVE_SETTING";

export const settingStore = {
  getters: {
    [GET_SIMPLE_MODE_DATA](state) {
      return state.simpleMode;
    },
  },
  mutations: {
    [SET_HOTKEY_SETTING](
      state,
      { newHotkeys }: { newHotkeys: HotkeySetting[] }
    ) {
      state.hotkeySetting = newHotkeys;
    },
    [SET_SIMPLE_MODE_DATA](state, payload) {
      state.simpleMode = payload;
    },
  },
  actions: {
    [GET_HOTKEY_SETTING]: async ({ commit }) => {
      const hotkey = window.electron.hotkeySetting("", -1);
      hotkey.then((value) => {
        commit(SET_HOTKEY_SETTING, {
          newHotkeys: value,
        });
      });
    },
    [SET_HOTKEY_SETTING]: (
      { commit },
      { combination, id }: { combination: string; id: number }
    ) => {
      const newHotkeys = window.electron.hotkeySetting(combination, id);
      newHotkeys.then((value) => {
        commit(SET_HOTKEY_SETTING, {
          newHotkeys: value,
        });
      });
    },
    [OPEN_FILE_EXPLORE]: createUILockAction(async ({ state, dispatch }) => {
      const dirPath = await window.electron.showOpenDirectoryDialog({
        title: "Select Default Output Directory",
      });
      if (dirPath) {
        dispatch(SET_SIMPLE_MODE_DATA);
      }
    }),
    [RESET_SETTING]: () => {
      window.electron.resetSetting();
    },
  },
} as StoreOptions<State>;
