import { createLogger } from "vuex";
import { indexStore } from "@/store/index";
import { createStore } from "@/store/vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  Command,
  State,
} from "@/store/type";
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
import { EngineId } from "@/type/preload";
const isDevelopment = process.env.NODE_ENV == "development";

function createDummyStore(
  initialUndoCommand?: Command[],
  initialRedoCommand?: Command[]
) {
  const engineId = EngineId("88022f86-c823-436e-85a3-500c629749c4");
  return createStore<State, AllGetters, AllActions, AllMutations>({
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
      undoCommands: initialUndoCommand ?? [],
      redoCommands: initialRedoCommand ?? [],
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
    },
    plugins: isDevelopment ? [createLogger()] : undefined,
    strict: process.env.NODE_ENV !== "production",
  });
}

const dummyCommand: Command = {
  unixMillisec: Date.now(),
  undoPatches: [],
  redoPatches: [],
};

test("CAN_UNDO undoCommands配列が絡んあらfalseそうでなければtrue", () => {
  let store = createDummyStore();
  expect(
    commandStore.getters.CAN_UNDO(
      store.state,
      store.getters,
      store.state,
      store.getters
    )
  ).toBe(false);
  store = createDummyStore([dummyCommand]);
  expect(
    commandStore.getters.CAN_UNDO(
      store.state,
      store.getters,
      store.state,
      store.getters
    )
  ).toBe(true);
});

test("CAN_REDO redoCommands配列が空ならfalseそうでなければtrue", () => {
  let store = createDummyStore();
  expect(
    commandStore.getters.CAN_REDO(
      store.state,
      store.getters,
      store.state,
      store.getters
    )
  ).toBe(false);
  store = createDummyStore(undefined, [dummyCommand]);

  expect(
    commandStore.getters.CAN_REDO(
      store.state,
      store.getters,
      store.state,
      store.getters
    )
  ).toBe(true);
});

test("LAST_COMMAND_UNIX_MILLISEC 配列の中身が空ならnullを返し、それ以外なら一番最後のundoCommandsからUnixMilisecを取り出す", () => {
  let store = createDummyStore();
  expect(
    commandStore.getters.LAST_COMMAND_UNIX_MILLISEC(
      store.state,
      store.getters,
      store.state,
      store.getters
    )
  ).toBe(null);
  store = createDummyStore([dummyCommand], undefined);

  expect(
    commandStore.getters.LAST_COMMAND_UNIX_MILLISEC(
      store.state,
      store.getters,
      store.state,
      store.getters
    )
  ).toBe(store.state.undoCommands[0].unixMillisec);
});

test("CLEAR_COMMANDS でUNDOとREDOの状態を初期化", () => {
  const store = createDummyStore([dummyCommand], [dummyCommand]);
  store.commit("CLEAR_COMMANDS");

  expect(store.state.undoCommands.length).toBe(0);
  expect(store.state.redoCommands.length).toBe(0);
});
