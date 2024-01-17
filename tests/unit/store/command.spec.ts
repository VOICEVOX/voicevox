import { createLogger } from "vuex";
import { indexStore } from "@/store/index";
import { createStore } from "@/store/vuex";
import {
  AllActions,
  AllGetters,
  AllMutations,
  CommandStoreState,
  State,
  StoreType,
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
import {
  createCommandMutation,
  createCommandMutationTree,
  PayloadRecipe,
} from "@/store/command";

function createDummyStore() {
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
      undoCommands: [],
      redoCommands: [],
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

describe("commandStoreのテスト", () => {
  it("CAN_UNDO getterが正しく動作する", () => {
    const store = createDummyStore();
    expect(
      commandStore.getters.CAN_UNDO(
        store.state,
        store.getters,
        store.state,
        store.getters
      )
    ).toBe(false);
    store.state.undoCommands.push({
      unixMillisec: Date.now(),
      undoPatches: [],
      redoPatches: [],
    });
    expect(
      commandStore.getters.CAN_UNDO(
        store.state,
        store.getters,
        store.state,
        store.getters
      )
    ).toBe(true);
  });

  it("CAN_REDO getterが正しく動作する", () => {
    const store = createDummyStore();
    expect(
      commandStore.getters.CAN_REDO(
        store.state,
        store.getters,
        store.state,
        store.getters
      )
    ).toBe(false);
    store.state.redoCommands.push({
      unixMillisec: Date.now(),
      undoPatches: [],
      redoPatches: [],
    });
    expect(
      commandStore.getters.CAN_REDO(
        store.state,
        store.getters,
        store.state,
        store.getters
      )
    ).toBe(true);
  });

  // UNDOとREDOのミューテーションは、applyPatchesImpl関数を使用しています。
  // この関数の動作をモックするか、または実際のパッチを検証するテストを書く必要があります。

  it("LAST_COMMAND_UNIX_MILLISEC getterが正しく動作する", () => {
    const store = createDummyStore();
    expect(
      commandStore.getters.LAST_COMMAND_UNIX_MILLISEC(
        store.state,
        store.getters,
        store.state,
        store.getters
      )
    ).toBe(null);
    const command = {
      unixMillisec: Date.now(),
      undoPatches: [],
      redoPatches: [],
    };
    store.state.undoCommands.push(command);
    expect(
      commandStore.getters.LAST_COMMAND_UNIX_MILLISEC(
        store.state,
        store.getters,
        store.state,
        store.getters
      )
    ).toBe(command.unixMillisec);
  });

  it("CLEAR_COMMANDS mutationが正しく動作する", () => {
    const store = createDummyStore();
    store.state.undoCommands.push({
      unixMillisec: Date.now(),
      undoPatches: [],
      redoPatches: [],
    });
    store.state.redoCommands.push({
      unixMillisec: Date.now(),
      undoPatches: [],
      redoPatches: [],
    });
    commandStore.mutations.CLEAR_COMMANDS(store.state, undefined);
    expect(store.state.undoCommands.length).toBe(0);
    expect(store.state.redoCommands.length).toBe(0);
  });

  it("createCommandMutationが正しく動作する", () => {
    const store = createDummyStore();
    const payloadRecipe: PayloadRecipe<CommandStoreState, { value: number }> = (
      draft,
      payload
    ) => {
      draft.undoCommands.push({
        unixMillisec: payload.value,
        undoPatches: [],
        redoPatches: [],
      });
    };
    const mutation = createCommandMutation(payloadRecipe);
    const initialLength = store.state.undoCommands.length;
    mutation(store.state, { value: 123 });
    expect(store.state.undoCommands.length).toBe(initialLength + 1);
    expect(store.state.undoCommands[initialLength].unixMillisec).toBe(123);
  });

  it("createCommandMutationTreeが正しく動作する", () => {
    const store = createDummyStore();
    const payloadRecipeTree = {
      ADD_VALUE: (draft: CommandStoreState, payload: { value: number }) => {
        draft.undoCommands.push({
          unixMillisec: payload.value,
          undoPatches: [],
          redoPatches: [],
        });
      },
    };
    const mutationTree =
      createCommandMutationTree<
        CommandStoreState,
        { ADD_VALUE: { value: number } }
      >(payloadRecipeTree);
    mutationTree.ADD_VALUE(store.state, { value: 123 });
    expect(store.state.undoCommands[0].unixMillisec).toBe(123);
  });
});
