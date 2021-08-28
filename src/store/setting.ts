import { StoreOptions } from "vuex";
import { State } from "./type";

export const GET_HOTKEY_SETTING = "GET_HOTKEY_SETTING";
export const SET_HOTKEY_SETTING = "SET_HOTKEY_SETTING";
export const GET_SIMPLE_MODE_DATA = "GET_SIMPLE_MODE_DATA";
export const SET_SIMPLE_MODE_DATA = "SET_SIMPLE_MODE_DATA";

export const SAVE_SETTING = "SAVE_SETTING";

export const settingStore = {
  getters: {
    [GET_HOTKEY_SETTING](state) {
      return state.hotkeySetting;
    },
    [GET_SIMPLE_MODE_DATA](state) {
      return state.simpleMode;
    },
  },
  mutations: {
    [SET_HOTKEY_SETTING](state, payload) {
      state.hotkeySetting = payload.data;
    },
    [SET_SIMPLE_MODE_DATA](state, payload) {
      state.simpleMode = payload;
    },
  },
  actions: {
    async [SET_HOTKEY_SETTING]({ commit }, payload) {
      commit(SET_HOTKEY_SETTING, payload);
    },
  },
} as StoreOptions<State>;
