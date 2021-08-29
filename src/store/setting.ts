import { StoreOptions } from "vuex";
import { HotkeySetting, MouseWheelSetting, SimpleMode, State } from "./type";
import { createUILockAction } from "./ui";
import { useStore } from "@/store";
import Mousetrap from "mousetrap";

export const GET_HOTKEY_SETTING = "GET_HOTKEY_SETTING";
export const SET_HOTKEY_SETTING = "SET_HOTKEY_SETTING";
export const GET_SIMPLE_MODE_DATA = "GET_SIMPLE_MODE_DATA";
export const SET_SIMPLE_MODE_DATA = "SET_SIMPLE_MODE_DATA";
export const OPEN_FILE_EXPLORE = "OPEN_FILE_EXPLORE";
export const RESET_SETTING = "RESET_SETTING";
export const GET_WHEEL_SETTING = "GET_WHEEL_SETTING";
export const SET_WHEEL_SETTING = "SET_WHEEL_SETTING";

export const SAVE_SETTING = "SAVE_SETTING";

export const settingStore = {
  getters: {
    [GET_SIMPLE_MODE_DATA](state) {
      return state.simpleMode;
    },
    [GET_HOTKEY_SETTING](state) {
      return state.hotkeySetting;
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
      state.simpleMode = payload.value;
    },
    [SET_WHEEL_SETTING](
      state,
      { newSetting }: { newSetting: MouseWheelSetting[] }
    ) {
      state.mouseWheelSetting = newSetting;
    },
  },
  actions: {
    [GET_HOTKEY_SETTING]: ({ commit }) => {
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
    [GET_WHEEL_SETTING]: ({ commit }) => {
      const newSetting = window.electron.mouseWheelSetting(false, false, -1);
      newSetting.then((value: MouseWheelSetting[]) => {
        commit(SET_WHEEL_SETTING, {
          newSetting: value,
        });
      });
    },
    [SET_WHEEL_SETTING]: (
      { commit },
      {
        enabled,
        reversed,
        id,
      }: { enabled: boolean; reversed: boolean; id: number }
    ) => {
      const newSetting = window.electron.mouseWheelSetting(
        enabled,
        reversed,
        id
      );
      newSetting.then((value: MouseWheelSetting[]) => {
        commit(SET_WHEEL_SETTING, {
          newSetting: value,
        });
      });
    },
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
    [OPEN_FILE_EXPLORE]: createUILockAction(async ({ commit }) => {
      const dirPath = await window.electron.showOpenDirectoryDialog({
        title: "Select Default Output Directory",
      });
      if (dirPath) {
        const newData = window.electron.simpleModeSetting({
          enabled: true,
          dir: dirPath,
        });
        newData.then((value) => {
          commit(SET_SIMPLE_MODE_DATA, {
            value: value,
          });
        });
      }
      return dirPath;
    }),
    [RESET_SETTING]: () => {
      window.electron.resetSetting();
    },
  },
} as StoreOptions<State>;

export const bindHotkeys = (
  newHotkeys: HotkeySetting[],
  numIndex: number[],
  actions: (() => void)[]
): void => {
  for (let i = 0; i < numIndex.length; i++) {
    const hotkeyIndex = numIndex[i];
    console.log(hotkeyIndex);
    const newCombination = newHotkeys[hotkeyIndex].combination
      .toLowerCase()
      .replace(" ", "+");
    if (newCombination === "") continue;
    Mousetrap.bind(newCombination, actions[i]);
  }
};

export const watchAndReset = (
  numIndex: number[],
  actions: (() => void)[]
): void => {
  const store = useStore();
  for (let i = 0; i < numIndex.length; i++) {
    store.watch(
      (state) => {
        return state.hotkeySetting[numIndex[i]];
      },
      (newVal, oldVal) => {
        Mousetrap.unbind(oldVal.combination.toLowerCase().replace(" ", "+"));
        Mousetrap.bind(
          newVal.combination.toLowerCase().replace(" ", "+"),
          actions[i]
        );
      }
    );
  }
};
