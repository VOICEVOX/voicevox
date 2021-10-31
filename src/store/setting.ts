import {
  HotkeyAction,
  HotkeyReturnType,
  HotkeySetting,
  SavingSetting,
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
  useVoicing: false,
  showSamplingRateWarning: true,
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
    GET_SHOW_SAMPLING_RATE_WARNING(state) {
      return state.showSamplingRateWarning;
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
    SET_USE_VOICING(state, { useVoicing }: { useVoicing: boolean }) {
      state.useVoicing = useVoicing;
    },
    SET_SHOW_SAMPLING_RATE_WARNING(
      state,
      { showSamplingRateWarning }: { showSamplingRateWarning: boolean }
    ) {
      state.showSamplingRateWarning = showSamplingRateWarning;
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
    GET_HOTKEY_SETTINGS({ state, dispatch }) {
      window.electron.hotkeySettings().then((hotkeys) => {
        hotkeys.forEach((hotkey) => {
          if (!state.useUndoRedo) {
            if (hotkey.action != "やり直す" && hotkey.action != "元に戻す") {
              dispatch("SET_HOTKEY_SETTINGS", {
                data: hotkey,
              });
            }
          } else {
            dispatch("SET_HOTKEY_SETTINGS", {
              data: hotkey,
            });
          }
        });
      });
    },
    SET_HOTKEY_SETTINGS({ state, commit }, { data }: { data: HotkeySetting }) {
      window.electron.hotkeySettings(data);
      state.hotkeySettings.forEach((oldData) => {
        if (oldData.action == data.action) {
          // pass the hotkey actions implemented with native js
          if (hotkeyFunctionCache[data.action] !== undefined) {
            if (oldData.combination != "") {
              Mousetrap.unbind(hotkey2Combo(oldData.combination));
            }
            if (data.combination != "") {
              Mousetrap.bind(
                hotkey2Combo(data.combination),
                hotkeyFunctionCache[data.action]
              );
            }
          }
        }
      });
      commit("SET_HOTKEY_SETTINGS", {
        newHotkey: data,
      });
    },
    GET_USE_VOICING({ commit }) {
      window.electron.useVoicing().then((useVoicing) => {
        commit("SET_USE_VOICING", { useVoicing: useVoicing });
      });
    },
    SET_USE_VOICING({ commit }, { data }: { data: boolean }) {
      window.electron.useVoicing(data);
      commit("SET_USE_VOICING", { useVoicing: data });
    },
    GET_SHOW_SAMPLING_RATE_WARNING({ commit }) {
      window.electron.showSamplingRateWarning().then((data) => {
        commit("SET_SHOW_SAMPLING_RATE_WARNING", {
          showSamplingRateWarning: data,
        });
      });
    },
    SET_SHOW_SAMPLING_RATE_WARNING({ commit }, { data }: { data: boolean }) {
      window.electron.showSamplingRateWarning(data);
      commit("SET_SHOW_SAMPLING_RATE_WARNING", {
        showSamplingRateWarning: data,
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
