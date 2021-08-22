import { Store } from "vuex";
export const settingStore = new Store({
  state: {
    count: 0,
  },
  mutations: {
    increment(state) {
      state.count++;
    },
  },
});
