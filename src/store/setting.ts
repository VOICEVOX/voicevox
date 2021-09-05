import { SavingSetting } from "@/type/preload";
import { StoreOptions } from "vuex";
import { State } from "./type";

export const GET_SAVING_SETTING_DATA = "GET_SAVING_SETTING_DATA";
export const SET_SAVING_SETTING_DATA = "SET_SAVING_SETTING_DATA";

export const settingStore = {
  getters: {
    [GET_SAVING_SETTING_DATA](state) {
      return state.savingSetting;
    },
  },
  mutations: {
    [SET_SAVING_SETTING_DATA](
      state,
      { savingSetting }: { savingSetting: SavingSetting }
    ) {
      state.savingSetting = savingSetting;
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
  },
} as StoreOptions<State>;
