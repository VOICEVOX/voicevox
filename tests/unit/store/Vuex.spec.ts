import { createLogger } from "vuex";
import { assert, describe, it } from "vitest";
import { indexStore } from "@/store/index";
import { createStore } from "@/store/vuex";
import { AllActions, AllGetters, AllMutations, State } from "@/store/type";
import { commandStore } from "@/store/command";
import { audioStore, audioCommandStore } from "@/store/audio";
import { audioPlayerStore } from "@/store/audioPlayer";
import { projectStore } from "@/store/project";
import { uiStore } from "@/store/ui";
import { settingStore } from "@/store/setting";
import { presetStore } from "@/store/preset";
import { proxyStore } from "@/store/proxy";
import { dictionaryStore } from "@/store/dictionary";
import { engineStore } from "@/store/engine";
import { singingStore } from "@/store/singing";
import { EngineId } from "@/type/preload";
const isDevelopment = process.env.NODE_ENV == "development";
// TODO: Swap external files to Mock

describe("store/vuex.js test", () => {
  it("create store", () => {
    const engineId = EngineId("88022f86-c823-436e-85a3-500c629749c4");
    const store = createStore<State, AllGetters, AllActions, AllMutations>({
      state: {
        engineStates: {
          [engineId]: "STARTING",
        },
        engineSupportedDevices: {},
        altPortInfos: {},
        characterInfos: {},
        audioKeysWithInitializingSpeaker: [],
        morphableTargetsInfo: {},
        defaultStyleIds: [],
        userCharacterOrder: [],
        audioItems: {},
        audioKeys: [],
        audioStates: {},
        uiLockCount: 0,
        dialogLockCount: 0,
        reloadingLock: false,
        nowPlayingContinuously: false,
        undoCommands: [],
        redoCommands: [],
        undoSongCommands: [],
        redoSongCommands: [],
        inheritAudioInfo: true,
        activePointScrollMode: "OFF",
        isHelpDialogOpen: false,
        isSettingDialogOpen: false,
        isHotkeySettingDialogOpen: false,
        isToolbarSettingDialogOpen: false,
        isCharacterOrderDialogOpen: false,
        isDefaultStyleSelectDialogOpen: false,
        isDictionaryManageDialogOpen: false,
        isEngineManageDialogOpen: false,
        isUpdateNotificationDialogOpen: false,
        isAcceptRetrieveTelemetryDialogOpen: false,
        isAcceptTermsDialogOpen: false,
        isMaximized: false,
        isMultiEngineOffMode: false,
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
          audioOutputDevice: "default",
        },
        engineSettings: {
          [engineId]: {
            outputSamplingRate: "engineDefault",
            useGpu: false,
          },
        },
        themeSetting: {
          currentTheme: "Default",
          availableThemes: [],
        },
        editorFont: "default",
        showTextLineNumber: false,
        showAddAudioItemButton: true,
        isPinned: false,
        isFullscreen: false,
        presetItems: {},
        presetKeys: [],
        hotkeySettings: [],
        toolbarSetting: [],
        acceptRetrieveTelemetry: "Unconfirmed",
        acceptTerms: "Unconfirmed",
        engineIds: [engineId],
        engineInfos: {
          [engineId]: {
            uuid: engineId,
            name: "Engine 1",
            executionEnabled: false,
            executionFilePath: "",
            executionArgs: [],
            host: "http://127.0.0.1",
            type: "default",
          },
        },
        engineManifests: {
          [engineId]: {
            manifestVersion: "0.13.0",
            name: "DUMMY VOICEVOX ENGINE",
            brandName: "DUMMY VOICEVOX",
            uuid: "c7b58856-bd56-4aa1-afb7-b8415f824b06",
            url: "https://github.com/VOICEVOX/voicevox_engine",
            icon: "engine_manifest_assets/icon.png",
            defaultSamplingRate: 24000,
            termsOfService: "engine_manifest_assets/terms_of_service.md",
            updateInfos: [],
            dependencyLicenses: [],
            supportedFeatures: {
              adjustMoraPitch: true,
              adjustPhonemeLength: true,
              adjustSpeedScale: true,
              adjustPitchScale: true,
              adjustIntonationScale: true,
              adjustVolumeScale: true,
              interrogativeUpspeak: true,
              synthesisMorphing: true,
            },
            frameRate: 93.75,
          },
        },
        experimentalSetting: {
          enablePreset: false,
          shouldApplyDefaultPresetOnVoiceChanged: false,
          enableInterrogativeUpspeak: false,
          enableMorphing: false,
          enableMultiSelect: false,
          shouldKeepTuningOnTextChange: false,
        },
        splitTextWhenPaste: "PERIOD_AND_NEW_LINE",
        splitterPosition: {
          audioDetailPaneHeight: 200,
          audioInfoPaneWidth: 20,
          portraitPaneWidth: 50,
        },
        confirmedTips: {
          tweakableSliderByScroll: false,
          engineStartedOnAltPort: false,
          notifyOnGenerate: false,
        },
        enableMultiEngine: false,
        enableMemoNotation: false,
        enableRubyNotation: false,
        progress: -1,
        isVuexReady: false,
        defaultPresetKeys: {},
        tpqn: 480,
        tempos: [
          {
            position: 0,
            bpm: 120,
          },
        ],
        timeSignatures: [
          {
            measureNumber: 1,
            beats: 4,
            beatType: 4,
          },
        ],
        tracks: [
          {
            notesKeyShift: 0,
            voiceKeyShift: 0,
            notes: [],
          },
        ],
        phrases: new Map(),
        isShowSinger: true,
        sequencerZoomX: 1,
        sequencerZoomY: 1,
        sequencerSnapType: 16,
        selectedNoteIds: new Set(),
        overlappingNoteIds: new Set(),
        overlappingNoteInfos: new Map(),
        nowPlaying: false,
        volume: 0,
        leftLocatorPosition: 0,
        rightLocatorPosition: 0,
        startRenderingRequested: false,
        stopRenderingRequested: false,
        nowRendering: false,
        nowAudioExporting: false,
        cancellationOfAudioExportRequested: false,
      },
      getters: {
        ...uiStore.getters,
        ...audioStore.getters,
        ...audioPlayerStore.getters,
        ...commandStore.getters,
        ...engineStore.getters,
        ...projectStore.getters,
        ...settingStore.getters,
        ...audioCommandStore.getters,
        ...indexStore.getters,
        ...presetStore.getters,
        ...proxyStore.getters,
        ...dictionaryStore.getters,
        ...singingStore.getters,
      },
      mutations: {
        ...uiStore.mutations,
        ...audioStore.mutations,
        ...audioPlayerStore.mutations,
        ...commandStore.mutations,
        ...engineStore.mutations,
        ...projectStore.mutations,
        ...settingStore.mutations,
        ...audioCommandStore.mutations,
        ...indexStore.mutations,
        ...presetStore.mutations,
        ...proxyStore.mutations,
        ...dictionaryStore.mutations,
        ...singingStore.mutations,
      },
      actions: {
        ...uiStore.actions,
        ...audioStore.actions,
        ...audioPlayerStore.actions,
        ...commandStore.actions,
        ...engineStore.actions,
        ...projectStore.actions,
        ...settingStore.actions,
        ...audioCommandStore.actions,
        ...indexStore.actions,
        ...presetStore.actions,
        ...proxyStore.actions,
        ...dictionaryStore.actions,
        ...singingStore.actions,
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
    assert.isObject(store.state.morphableTargetsInfo);
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
    assert.equal(store.state.showTextLineNumber, false);
    assert.equal(store.state.showAddAudioItemButton, true);
    assert.propertyVal(
      store.state.splitterPosition,
      "audioDetailPaneHeight",
      200
    );
    assert.propertyVal(store.state.splitterPosition, "audioInfoPaneWidth", 20);
    assert.propertyVal(store.state.splitterPosition, "portraitPaneWidth", 50);
    assert.equal(store.state.confirmedTips.tweakableSliderByScroll, false);
    assert.equal(store.state.confirmedTips.engineStartedOnAltPort, false);
    assert.equal(store.state.confirmedTips.notifyOnGenerate, false);
  });
});
