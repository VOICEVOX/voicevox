import {
  HotkeyAction,
  HotkeyReturnType,
  HotkeySetting,
  SavingSetting,
  ToolbarSetting,
} from "@/type/preload";
import {
  SettingGetters,
  SettingActions,
  SettingMutations,
  SettingStoreState,
  VoiceVoxStoreOptions,
} from "./type";
import Mousetrap from "mousetrap";
import { useStore } from "@/store";

const hotkeyFunctionCache: Record<string, () => HotkeyReturnType> = {};

export const settingStoreState: SettingStoreState = {
  savingSetting: {
    fileEncoding: "UTF-8",
    fixedExportEnabled: false,
    fixedExportDir: "",
    avoidOverwrite: false,
    exportLab: false,
    exportText: true,
    outputStereo: false,
    outputSamplingRate: 24000,
  },
  hotkeySettings: [],
  toolbarSetting: {
    buttons: [],
  },
  engineHost: process.env.VUE_APP_ENGINE_URL as unknown as string,
};

export const settingStore: VoiceVoxStoreOptions<
  SettingGetters,
  SettingActions,
  SettingMutations
> = {
  getters: {
    GET_SAVING_SETTING(state) {
      return state.savingSetting;
    },
  },
  mutations: {
    SET_SAVING_SETTING(
      state,
      { savingSetting }: { savingSetting: SavingSetting }
    ) {
      state.savingSetting = savingSetting;
    },
    SET_HOTKEY_SETTINGS(state, { newHotkey }: { newHotkey: HotkeySetting }) {
      let flag = true;
      state.hotkeySettings.forEach((hotkey) => {
        if (hotkey.action == newHotkey.action) {
          hotkey.combination = newHotkey.combination;
          flag = false;
        }
      });
      if (flag) state.hotkeySettings.push(newHotkey);
    },
    SET_TOOLBAR_SETTING(
      state,
      { toolbarSetting }: { toolbarSetting: ToolbarSetting }
    ) {
      state.toolbarSetting = toolbarSetting;
    },
  },
  actions: {
    GET_SAVING_SETTING({ commit }) {
      const newData = window.electron.savingSetting();
      newData.then((savingSetting) => {
        commit("SET_SAVING_SETTING", { savingSetting: savingSetting });
      });
    },
    SET_SAVING_SETTING({ commit }, { data }: { data: SavingSetting }) {
      const newData = window.electron.savingSetting(data);
      newData.then((savingSetting) => {
        commit("SET_SAVING_SETTING", { savingSetting: savingSetting });
      });
    },
    GET_HOTKEY_SETTINGS({ dispatch }) {
      window.electron.hotkeySettings().then((hotkeys) => {
        hotkeys.forEach((hotkey) => {
          dispatch("SET_HOTKEY_SETTINGS", {
            data: hotkey,
          });
        });
      });
    },
    SET_HOTKEY_SETTINGS({ state, commit }, { data }: { data: HotkeySetting }) {
      window.electron.hotkeySettings(data);
      const oldHotkey = state.hotkeySettings.find((value) => {
        value.action == data.action;
      });
      if (oldHotkey !== undefined) {
        if (oldHotkey.combination != "") {
          Mousetrap.unbind(hotkey2Combo(oldHotkey.combination));
        }
      }
      if (
        data.combination != "" &&
        hotkeyFunctionCache[data.action] !== undefined
      ) {
        Mousetrap.bind(
          hotkey2Combo(data.combination),
          hotkeyFunctionCache[data.action]
        );
      }
      commit("SET_HOTKEY_SETTINGS", {
        newHotkey: data,
      });
    },
    GET_TOOLBAR_SETTING({ commit }) {
      const newData = window.electron.toolbarSetting();
      newData.then((toolbarSetting) => {
        commit("SET_TOOLBAR_SETTING", { toolbarSetting });
      });
    },
    SET_TOOLBAR_SETTING({ commit }, { data }: { data: ToolbarSetting }) {
      const newData = window.electron.toolbarSetting(data);
      newData.then((toolbarSetting) => {
        commit("SET_TOOLBAR_SETTING", { toolbarSetting });
      });
    },
  },
};

export const setHotkeyFunctions = (
  hotkeyMap: Map<HotkeyAction, () => HotkeyReturnType>,
  reassign?: boolean
): void => {
  hotkeyMap.forEach((value, key) => {
    hotkeyFunctionCache[key] = value;
  });
  if (reassign) {
    const store = useStore();
    hotkeyMap.forEach((hotkeyFunction, hotkeyAction) => {
      const hotkey = store.state.hotkeySettings.find((value) => {
        return value.action == hotkeyAction;
      });
      if (hotkey) {
        store.dispatch("SET_HOTKEY_SETTINGS", { data: { ...hotkey } });
      }
    });
  }
};

const hotkey2Combo = (hotkeyCombo: string) => {
  return hotkeyCombo.toLowerCase().replaceAll(" ", "+");
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
    if (["Control", "Shift", "Alt"].indexOf(event.key) == -1) {
      recordedCombo +=
        event.key.length > 1 ? event.key : event.key.toUpperCase();
    } else {
      recordedCombo = recordedCombo.slice(0, -1);
    }
  }
  return recordedCombo;
};
