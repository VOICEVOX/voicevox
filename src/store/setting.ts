import { Store, StoreOptions } from "vuex";
import { State } from "./type";

export const GET_HOTKEY_SETTING = "GET_SETTING";
export const SAVE_SETTING = "SAVE_SETTING";

export const settingStore = {
  getters: {
    [GET_HOTKEY_SETTING](state) {
      return 1;
    },
  },
} as StoreOptions<State>;
