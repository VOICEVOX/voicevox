import { StoreOptions } from "vuex";
import { SimpleMode, State } from "./type";

export const GET_HOTKEY_SETTING = "GET_HOTKEY_SETTING";
export const SET_HOTKEY_SETTING = "SET_HOTKEY_SETTING";
export const GET_SIMPLE_MODE_DATA = "GET_SIMPLE_MODE_DATA";
export const SET_SIMPLE_MODE_DATA = "SET_SIMPLE_MODE_DATA";
export const RESET_SETTING = "RESET_SETTING";

export const SAVE_SETTING = "SAVE_SETTING";

export const settingStore = {
  getters: {
    [GET_SIMPLE_MODE_DATA](state) {
      return state.simpleMode;
    },
  },
  mutations: {
    [SET_SIMPLE_MODE_DATA](state, payload) {
      state.simpleMode = payload.value;
    },
  },
  actions: {
    [GET_SIMPLE_MODE_DATA]: ({ commit }) => {
      const newData = window.electron.simpleModeSetting();
      newData.then((value) => {
        commit(SET_SIMPLE_MODE_DATA, { value: value });
      });
    },
    [SET_SIMPLE_MODE_DATA]: ({ commit }, { data }: { data: SimpleMode }) => {
      const newData = window.electron.simpleModeSetting(data);
      newData.then((value) => {
        commit(SET_SIMPLE_MODE_DATA, { value: value });
      });
    },
  },
} as StoreOptions<State>;
