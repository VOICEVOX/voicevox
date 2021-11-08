import { createLogger } from "vuex";
import { indexStore } from "@/store/index";
import { createStore } from "@/store/vuex";
import { AllActions, AllGetters, AllMutations, State } from "@/store/type";
import { commandStore } from "@/store/command";
import { audioStore, audioCommandStore } from "@/store/audio";
import { projectStore } from "@/store/project";
import { uiStore } from "@/store/ui";
import { settingStore } from "@/store/setting";
import { assert } from "chai";
const isDevelopment = process.env.NODE_ENV == "development";
// TODO: Swap external files to Mock

describe("store/vuex.js test", () => {
  it("creaete store", () => {
    const store = createStore<State, AllGetters, AllActions, AllMutations>({
      state: {
        engineState: "STARTING",
        defaultStyleIds: [],
        audioItems: {},
        audioKeys: [],
        audioStates: {},
        uiLockCount: 0,
        nowPlayingContinuously: false,
        undoCommands: [],
        redoCommands: [],
        useGpu: false,
        inheritAudioInfo: true,
        isHelpDialogOpen: false,
        isSettingDialogOpen: false,
        isHotkeySettingDialogOpen: false,
        isDefaultStyleSelectDialogOpen: false,
        isMaximized: false,
        savedLastCommandUnixMillisec: null,
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
        isPinned: false,
        hotkeySettings: [],
        engineHost: "http://127.0.0.1",
      },
      getters: {
        ...uiStore.getters,
        ...audioStore.getters,
        ...commandStore.getters,
        ...projectStore.getters,
        ...settingStore.getters,
        ...audioCommandStore.getters,
        ...indexStore.getters,
      },
      mutations: {
        ...uiStore.mutations,
        ...audioStore.mutations,
        ...commandStore.mutations,
        ...projectStore.mutations,
        ...settingStore.mutations,
        ...audioCommandStore.mutations,
        ...indexStore.mutations,
      },
      actions: {
        ...uiStore.actions,
        ...audioStore.actions,
        ...commandStore.actions,
        ...projectStore.actions,
        ...settingStore.actions,
        ...audioCommandStore.actions,
        ...indexStore.actions,
      },
      plugins: isDevelopment ? [createLogger()] : undefined,
      strict: process.env.NODE_ENV !== "production",
    });
    assert.exists(store);
    assert.isObject(store);
    assert.isObject(store.state);
    assert.equal(store.state.engineState, "STARTING");
    assert.isArray(store.state.defaultStyleIds);
    assert.isObject(store.state.audioItems);
    assert.isEmpty(store.state.audioItems);
    assert.isArray(store.state.audioKeys);
    assert.isEmpty(store.state.audioKeys);
    assert.isObject(store.state.audioStates);
    assert.isEmpty(store.state.audioStates);
    assert.equal(store.state.uiLockCount, 0);
    assert.equal(store.state.nowPlayingContinuously, false);
    assert.isArray(store.state.undoCommands);
    assert.isEmpty(store.state.undoCommands);
    assert.isArray(store.state.redoCommands);
    assert.isEmpty(store.state.redoCommands);
    assert.equal(store.state.useGpu, false);
    assert.equal(store.state.inheritAudioInfo, true);
    assert.equal(store.state.isHelpDialogOpen, false);
    assert.equal(store.state.isSettingDialogOpen, false);
    assert.equal(store.state.isHotkeySettingDialogOpen, false);
    assert.equal(store.state.isDefaultStyleSelectDialogOpen, false);
    assert.equal(store.state.isMaximized, false);
    assert.isObject(store.state.savingSetting);
    assert.propertyVal(store.state.savingSetting, "fileEncoding", "UTF-8");
    assert.propertyVal(store.state.savingSetting, "fixedExportEnabled", false);
    assert.propertyVal(store.state.savingSetting, "fixedExportDir", "");
    assert.propertyVal(store.state.savingSetting, "avoidOverwrite", false);
    assert.propertyVal(store.state.savingSetting, "exportLab", false);
    assert.equal(store.state.isPinned, false);
    assert.isArray(store.state.hotkeySettings);
    assert.isEmpty(store.state.hotkeySettings);
  });
});
