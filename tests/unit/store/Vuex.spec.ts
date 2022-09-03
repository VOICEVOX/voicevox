import { createLogger } from "vuex";
import { indexStore } from "@/store/index";
import { createStore } from "@/store/vuex";
import { AllActions, AllGetters, AllMutations, State } from "@/store/type";
import { commandStore } from "@/store/command";
import { audioStore, audioCommandStore } from "@/store/audio";
import { projectStore } from "@/store/project";
import { uiStore } from "@/store/ui";
import { settingStore } from "@/store/setting";
import { presetStore } from "@/store/preset";
import { assert } from "chai";
import { proxyStore } from "@/store/proxy";
import { dictionaryStore } from "@/store/dictionary";
const isDevelopment = process.env.NODE_ENV == "development";
// TODO: Swap external files to Mock

describe("store/vuex.js test", () => {
  it("create store", () => {
    const store = createStore<State, AllGetters, AllActions, AllMutations>({
      state: {
        engineStates: {
          "88022f86-c823-436e-85a3-500c629749c4": "STARTING",
        },
        characterInfos: {},
        defaultStyleIds: [],
        userCharacterOrder: [],
        audioItems: {},
        audioKeys: [],
        audioStates: {},
        audioPlayStartPoint: 0,
        uiLockCount: 0,
        dialogLockCount: 0,
        nowPlayingContinuously: false,
        undoCommands: [],
        redoCommands: [],
        useGpu: false,
        inheritAudioInfo: true,
        activePointScrollMode: "OFF",
        isHelpDialogOpen: false,
        isSettingDialogOpen: false,
        isHotkeySettingDialogOpen: false,
        isToolbarSettingDialogOpen: false,
        isCharacterOrderDialogOpen: false,
        isDefaultStyleSelectDialogOpen: false,
        isDictionaryManageDialogOpen: false,
        isAcceptRetrieveTelemetryDialogOpen: false,
        isAcceptTermsDialogOpen: false,
        isMaximized: false,
        savedLastCommandUnixMillisec: null,
        savingSetting: {
          fileEncoding: "UTF-8",
          fileNamePattern: "",
          fixedExportEnabled: false,
          fixedExportDir: "",
          avoidOverwrite: false,
          exportLab: false,
          exportText: false,
          outputStereo: false,
          outputSamplingRate: 24000,
          audioOutputDevice: "default",
        },
        themeSetting: {
          currentTheme: "Default",
          availableThemes: [],
        },
        isPinned: false,
        isFullscreen: false,
        presetItems: {},
        presetKeys: [],
        hotkeySettings: [],
        toolbarSetting: [],
        acceptRetrieveTelemetry: "Unconfirmed",
        acceptTerms: "Unconfirmed",
        engineIds: ["88022f86-c823-436e-85a3-500c629749c4"],
        engineInfos: {
          "88022f86-c823-436e-85a3-500c629749c4": {
            uuid: "88022f86-c823-436e-85a3-500c629749c4",
            name: "Engine 1",
            executionEnabled: false,
            executionFilePath: "",
            host: "http://127.0.0.1",
          },
        },
        experimentalSetting: {
          enablePreset: false,
          enableInterrogativeUpspeak: false,
        },
        splitTextWhenPaste: "PERIOD_AND_NEW_LINE",
        splitterPosition: {
          audioDetailPaneHeight: 200,
          audioInfoPaneWidth: 20,
          portraitPaneWidth: 50,
        },
        confirmedTips: {
          tweakableSliderByScroll: false,
        },
      },
      getters: {
        ...uiStore.getters,
        ...audioStore.getters,
        ...commandStore.getters,
        ...projectStore.getters,
        ...settingStore.getters,
        ...audioCommandStore.getters,
        ...indexStore.getters,
        ...presetStore.getters,
        ...proxyStore.getters,
        ...dictionaryStore.getters,
      },
      mutations: {
        ...uiStore.mutations,
        ...audioStore.mutations,
        ...commandStore.mutations,
        ...projectStore.mutations,
        ...settingStore.mutations,
        ...audioCommandStore.mutations,
        ...indexStore.mutations,
        ...presetStore.mutations,
        ...proxyStore.mutations,
        ...dictionaryStore.mutations,
      },
      actions: {
        ...uiStore.actions,
        ...audioStore.actions,
        ...commandStore.actions,
        ...projectStore.actions,
        ...settingStore.actions,
        ...audioCommandStore.actions,
        ...indexStore.actions,
        ...presetStore.actions,
        ...proxyStore.actions,
        ...dictionaryStore.actions,
      },
      plugins: isDevelopment ? [createLogger()] : undefined,
      strict: process.env.NODE_ENV !== "production",
    });
    assert.exists(store);
    assert.isObject(store);
    assert.isObject(store.state);
    assert.hasAllKeys(store.state.engineStates, store.state.engineIds);
    store.state.engineIds.forEach((engineId) =>
      assert.equal(store.state.engineStates[engineId], "STARTING")
    );
    assert.isObject(store.state.characterInfos);
    assert.isArray(store.state.defaultStyleIds);
    assert.isObject(store.state.audioItems);
    assert.isEmpty(store.state.audioItems);
    assert.isArray(store.state.audioKeys);
    assert.isEmpty(store.state.audioKeys);
    assert.isObject(store.state.audioStates);
    assert.isEmpty(store.state.audioStates);
    assert.equal(store.state.audioPlayStartPoint, 0);
    assert.equal(store.state.uiLockCount, 0);
    assert.equal(store.state.nowPlayingContinuously, false);
    assert.isArray(store.state.undoCommands);
    assert.isEmpty(store.state.undoCommands);
    assert.isArray(store.state.redoCommands);
    assert.isEmpty(store.state.redoCommands);
    assert.equal(store.state.useGpu, false);
    assert.equal(store.state.inheritAudioInfo, true);
    assert.equal(store.state.activePointScrollMode, "OFF");
    assert.equal(store.state.isHelpDialogOpen, false);
    assert.equal(store.state.isSettingDialogOpen, false);
    assert.equal(store.state.isHotkeySettingDialogOpen, false);
    assert.equal(store.state.isCharacterOrderDialogOpen, false);
    assert.equal(store.state.isDefaultStyleSelectDialogOpen, false);
    assert.equal(store.state.isDictionaryManageDialogOpen, false);
    assert.equal(store.state.isAcceptRetrieveTelemetryDialogOpen, false);
    assert.equal(store.state.isAcceptTermsDialogOpen, false);
    assert.equal(store.state.isMaximized, false);
    assert.isObject(store.state.savingSetting);
    assert.propertyVal(store.state.savingSetting, "fileEncoding", "UTF-8");
    assert.propertyVal(store.state.savingSetting, "fixedExportEnabled", false);
    assert.propertyVal(store.state.savingSetting, "fixedExportDir", "");
    assert.propertyVal(store.state.savingSetting, "avoidOverwrite", false);
    assert.propertyVal(store.state.savingSetting, "exportLab", false);
    assert.propertyVal(store.state.savingSetting, "fileNamePattern", "");
    assert.equal(store.state.isPinned, false);
    assert.isObject(store.state.presetItems);
    assert.isEmpty(store.state.presetItems);
    assert.isArray(store.state.presetKeys);
    assert.isEmpty(store.state.presetKeys);
    assert.isArray(store.state.hotkeySettings);
    assert.isEmpty(store.state.hotkeySettings);
    assert.propertyVal(store.state.themeSetting, "currentTheme", "Default");
    assert.property(store.state.themeSetting, "availableThemes");
    assert.isEmpty(store.state.themeSetting.availableThemes);
    assert.equal(store.state.acceptRetrieveTelemetry, "Unconfirmed");
    assert.equal(store.state.acceptTerms, "Unconfirmed");
    assert.isArray(store.state.engineIds);
    assert.isObject(store.state.engineInfos);
    assert.hasAllKeys(store.state.engineInfos, store.state.engineIds);
    assert.equal(store.state.experimentalSetting.enablePreset, false);
    assert.equal(
      store.state.experimentalSetting.enableInterrogativeUpspeak,
      false
    );
    assert.propertyVal(
      store.state.splitterPosition,
      "audioDetailPaneHeight",
      200
    );
    assert.propertyVal(store.state.splitterPosition, "audioInfoPaneWidth", 20);
    assert.propertyVal(store.state.splitterPosition, "portraitPaneWidth", 50);
  });
});
