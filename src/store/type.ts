import {
  MutationTree,
  MutationsBase,
  GettersBase,
  ActionsBase,
  StoreOptions,
  PayloadFunction,
} from "./vuex";
import { Patch } from "immer";
import {
  AccentPhrase,
  AudioQuery,
  EngineManifest,
  SupportedDevicesInfo,
  UserDictWord,
  MorphableTargetInfo,
} from "@/openapi";
import { createCommandMutationTree, PayloadRecipeTree } from "./command";
import {
  CharacterInfo,
  DefaultStyleId,
  Encoding as EncodingType,
  AcceptRetrieveTelemetryStatus,
  AcceptTermsStatus,
  HotkeySetting,
  MoraDataType,
  SavingSetting,
  ThemeConf,
  ThemeSetting,
  ExperimentalSetting,
  ToolbarSetting,
  UpdateInfo,
  Preset,
  MorphingInfo,
  ActivePointScrollMode,
  EngineInfo,
  SplitTextWhenPasteType,
  SplitterPosition,
  ConfirmedTips,
  EngineDirValidationResult,
  LibraryInstallationState,
  EditorFontType,
  EngineSettings,
  MorphableTargetInfoTable,
  EngineSetting,
  Voice,
  EngineId,
  SpeakerId,
  AudioKey,
} from "@/type/preload";
import { IEngineConnectorFactory } from "@/infrastructures/EngineConnector";
import { QVueGlobals } from "quasar";

/**
 * エディタ用のAudioQuery
 */
export type EditorAudioQuery = Omit<AudioQuery, "outputSamplingRate"> & {
  outputSamplingRate: number | "engineDefault";
};

export type AudioItem = {
  text: string;
  voice: Voice;
  query?: EditorAudioQuery;
  presetKey?: string;
  morphingInfo?: MorphingInfo;
};

export type AudioState = {
  nowPlaying: boolean;
  nowGenerating: boolean;
};

export type Command = {
  unixMillisec: number;
  undoPatches: Patch[];
  redoPatches: Patch[];
};

export type EngineState = "STARTING" | "FAILED_STARTING" | "ERROR" | "READY";
export type SaveResult =
  | "SUCCESS"
  | "WRITE_ERROR"
  | "ENGINE_ERROR"
  | "CANCELED";
export type SaveResultObject = {
  result: SaveResult;
  path: string | undefined;
  errorMessage?: string;
};
export type ErrorTypeForSaveAllResultDialog = {
  path: string;
  message: string;
};

export type StoreType<T, U extends "getter" | "mutation" | "action"> = {
  [P in keyof T as Extract<keyof T[P], U> extends never
    ? never
    : P]: T[P] extends {
    [K in U]: infer R;
  }
    ? U extends "action"
      ? R extends PayloadFunction
        ? R
        : never
      : R
    : never;
};

export type QuasarDialog = QVueGlobals["dialog"];

/*
 * Audio Store Types
 */

export type AudioStoreState = {
  characterInfos: Record<EngineId, CharacterInfo[]>;
  morphableTargetsInfo: Record<EngineId, MorphableTargetInfoTable>;
  audioKeyInitializingSpeaker?: string;
  audioItems: Record<AudioKey, AudioItem>;
  audioKeys: AudioKey[];
  audioStates: Record<AudioKey, AudioState>;
  _activeAudioKey?: AudioKey;
  audioPlayStartPoint?: number;
  nowPlayingContinuously: boolean;
};

export type AudioStoreTypes = {
  ACTIVE_AUDIO_KEY: {
    getter: AudioKey | undefined;
  };

  HAVE_AUDIO_QUERY: {
    getter(audioKey: AudioKey): boolean;
  };

  IS_ACTIVE: {
    getter(audioKey: AudioKey): boolean;
  };

  ACTIVE_AUDIO_ELEM_CURRENT_TIME: {
    getter: number | undefined;
  };

  LOAD_CHARACTER: {
    action(payload: { engineId: EngineId }): void;
  };

  SET_CHARACTER_INFOS: {
    mutation: { engineId: EngineId; characterInfos: CharacterInfo[] };
  };

  CHARACTER_INFO: {
    getter(engineId: EngineId, styleId: number): CharacterInfo | undefined;
  };

  USER_ORDERED_CHARACTER_INFOS: {
    getter: CharacterInfo[] | undefined;
  };

  GENERATE_AUDIO_KEY: {
    action(): AudioKey;
  };

  SETUP_SPEAKER: {
    action(payload: {
      audioKey: AudioKey;
      engineId: EngineId;
      styleId: number;
    }): void;
  };

  SET_AUDIO_KEY_INITIALIZING_SPEAKER: {
    mutation: { audioKey?: AudioKey };
  };

  SET_ACTIVE_AUDIO_KEY: {
    mutation: { audioKey?: AudioKey };
    action(payload: { audioKey?: AudioKey }): void;
  };

  SET_AUDIO_PLAY_START_POINT: {
    mutation: { startPoint?: number };
    action(payload: { startPoint?: number }): void;
  };

  SET_AUDIO_NOW_PLAYING: {
    mutation: { audioKey: AudioKey; nowPlaying: boolean };
  };

  SET_AUDIO_NOW_GENERATING: {
    mutation: { audioKey: AudioKey; nowGenerating: boolean };
  };

  SET_NOW_PLAYING_CONTINUOUSLY: {
    mutation: { nowPlaying: boolean };
  };

  GENERATE_AUDIO_ITEM: {
    action(payload: {
      text?: string;
      voice?: Voice;
      presetKey?: string;
      baseAudioItem?: AudioItem;
    }): Promise<AudioItem>;
  };

  REGISTER_AUDIO_ITEM: {
    action(payload: {
      audioItem: AudioItem;
      prevAudioKey?: AudioKey;
    }): Promise<AudioKey>;
  };

  INSERT_AUDIO_ITEM: {
    mutation: {
      audioItem: AudioItem;
      audioKey: AudioKey;
      prevAudioKey: AudioKey | undefined;
    };
  };

  INSERT_AUDIO_ITEMS: {
    mutation: {
      audioKeyItemPairs: { audioItem: AudioItem; audioKey: AudioKey }[];
      prevAudioKey: AudioKey | undefined;
    };
  };

  REMOVE_AUDIO_ITEM: {
    mutation: { audioKey: AudioKey };
  };

  SET_AUDIO_KEYS: {
    mutation: { audioKeys: AudioKey[] };
  };

  REMOVE_ALL_AUDIO_ITEM: {
    action(): void;
  };

  GET_AUDIO_CACHE: {
    action(payload: { audioKey: AudioKey }): Promise<Blob | null>;
  };

  GET_AUDIO_CACHE_FROM_AUDIO_ITEM: {
    action(payload: { audioItem: AudioItem }): Promise<Blob | null>;
  };

  SET_AUDIO_TEXT: {
    mutation: { audioKey: AudioKey; text: string };
  };

  SET_AUDIO_SPEED_SCALE: {
    mutation: { audioKey: AudioKey; speedScale: number };
  };

  SET_AUDIO_PITCH_SCALE: {
    mutation: { audioKey: AudioKey; pitchScale: number };
  };

  SET_AUDIO_INTONATION_SCALE: {
    mutation: { audioKey: AudioKey; intonationScale: number };
  };

  SET_AUDIO_VOLUME_SCALE: {
    mutation: { audioKey: AudioKey; volumeScale: number };
  };

  SET_AUDIO_PRE_PHONEME_LENGTH: {
    mutation: { audioKey: AudioKey; prePhonemeLength: number };
  };

  SET_AUDIO_POST_PHONEME_LENGTH: {
    mutation: { audioKey: AudioKey; postPhonemeLength: number };
  };

  LOAD_MORPHABLE_TARGETS: {
    action(payload: { engineId: EngineId; baseStyleId: number }): void;
  };

  SET_MORPHABLE_TARGETS: {
    mutation: {
      engineId: EngineId;
      baseStyleId: number;
      morphableTargets?: Exclude<
        { [key: number]: MorphableTargetInfo },
        undefined
      >;
    };
  };

  SET_MORPHING_INFO: {
    mutation: {
      audioKey: AudioKey;
      morphingInfo: MorphingInfo | undefined;
    };
  };

  MORPHING_SUPPORTED_ENGINES: {
    getter: string[];
  };

  VALID_MORPHING_INFO: {
    getter(audioItem: AudioItem): boolean;
  };

  SET_AUDIO_QUERY: {
    mutation: { audioKey: AudioKey; audioQuery: AudioQuery };
    action(payload: { audioKey: AudioKey; audioQuery: AudioQuery }): void;
  };

  FETCH_AUDIO_QUERY: {
    action(payload: {
      text: string;
      engineId: EngineId;
      styleId: number;
    }): Promise<AudioQuery>;
  };

  SET_AUDIO_VOICE: {
    mutation: { audioKey: AudioKey; voice: Voice };
  };

  SET_ACCENT_PHRASES: {
    mutation: { audioKey: AudioKey; accentPhrases: AccentPhrase[] };
  };

  FETCH_ACCENT_PHRASES: {
    action(payload: {
      text: string;
      engineId: EngineId;
      styleId: number;
      isKana?: boolean;
    }): Promise<AccentPhrase[]>;
  };

  SET_SINGLE_ACCENT_PHRASE: {
    mutation: {
      audioKey: AudioKey;
      accentPhraseIndex: number;
      accentPhrases: AccentPhrase[];
    };
  };

  SET_AUDIO_MORA_DATA: {
    mutation: {
      audioKey: AudioKey;
      accentPhraseIndex: number;
      moraIndex: number;
      data: number;
      type: MoraDataType;
    };
  };

  APPLY_AUDIO_PRESET: {
    mutation: { audioKey: AudioKey };
  };

  FETCH_MORA_DATA: {
    action(payload: {
      accentPhrases: AccentPhrase[];
      engineId: EngineId;
      styleId: number;
    }): Promise<AccentPhrase[]>;
  };

  FETCH_AND_COPY_MORA_DATA: {
    action(payload: {
      accentPhrases: AccentPhrase[];
      engineId: EngineId;
      styleId: number;
      copyIndexes: number[];
    }): Promise<AccentPhrase[]>;
  };

  GENERATE_LAB: {
    action(payload: {
      audioKey: AudioKey;
      offset?: number;
    }): string | undefined;
  };

  GET_AUDIO_PLAY_OFFSETS: {
    action(payload: { audioKey: AudioKey }): number[];
  };

  GENERATE_AUDIO: {
    action(payload: { audioKey: AudioKey }): Promise<Blob>;
  };

  GENERATE_AUDIO_FROM_AUDIO_ITEM: {
    action(payload: { audioItem: AudioItem }): Blob;
  };

  CONNECT_AUDIO: {
    action(payload: { encodedBlobs: string[] }): Blob | null;
  };

  GENERATE_AND_SAVE_AUDIO: {
    action(payload: {
      audioKey: AudioKey;
      filePath?: string;
      encoding?: EncodingType;
    }): SaveResultObject;
  };

  GENERATE_AND_SAVE_ALL_AUDIO: {
    action(payload: {
      dirPath?: string;
      encoding?: EncodingType;
      callback?: (finishedCount: number, totalCount: number) => void;
    }): SaveResultObject[] | undefined;
  };

  GENERATE_AND_CONNECT_AND_SAVE_AUDIO: {
    action(payload: {
      filePath?: string;
      encoding?: EncodingType;
      callback?: (finishedCount: number, totalCount: number) => void;
    }): SaveResultObject | undefined;
  };

  CONNECT_AND_EXPORT_TEXT: {
    action(payload: {
      filePath?: string;
      encoding?: EncodingType;
    }): SaveResultObject | undefined;
  };

  PLAY_AUDIO: {
    action(payload: { audioKey: AudioKey }): boolean;
  };

  PLAY_AUDIO_BLOB: {
    action(payload: {
      audioBlob: Blob;
      audioElem: HTMLAudioElement;
      audioKey?: AudioKey;
    }): boolean;
  };

  STOP_AUDIO: {
    action(payload: { audioKey: AudioKey }): void;
  };

  SET_AUDIO_PRESET_KEY: {
    mutation: {
      audioKey: AudioKey;
      presetKey: string | undefined;
    };
  };

  PLAY_CONTINUOUSLY_AUDIO: {
    action(): void;
  };

  STOP_CONTINUOUSLY_AUDIO: {
    action(): void;
  };

  OPEN_TEXT_EDIT_CONTEXT_MENU: {
    action(): void;
  };

  CHECK_FILE_EXISTS: {
    action(payload: { file: string }): Promise<boolean>;
  };
};

/*
 * Audio Command Store Types
 */

export type AudioCommandStoreState = {
  //
};

export type AudioCommandStoreTypes = {
  COMMAND_REGISTER_AUDIO_ITEM: {
    mutation: {
      audioItem: AudioItem;
      audioKey: AudioKey;
      prevAudioKey: AudioKey | undefined;
      applyPreset: boolean;
    };
    action(payload: {
      audioItem: AudioItem;
      prevAudioKey: AudioKey | undefined;
      applyPreset: boolean;
    }): Promise<AudioKey>;
  };

  COMMAND_REMOVE_AUDIO_ITEM: {
    mutation: { audioKey: AudioKey };
    action(payload: { audioKey: AudioKey }): void;
  };

  COMMAND_SET_AUDIO_KEYS: {
    mutation: { audioKeys: AudioKey[] };
    action(payload: { audioKeys: AudioKey[] }): void;
  };

  COMMAND_CHANGE_AUDIO_TEXT: {
    mutation: { audioKey: AudioKey; text: string } & (
      | { update: "Text" }
      | { update: "AccentPhrases"; accentPhrases: AccentPhrase[] }
      | { update: "AudioQuery"; query: AudioQuery }
    );
    action(payload: { audioKey: AudioKey; text: string }): void;
  };

  COMMAND_CHANGE_VOICE: {
    mutation: { audioKey: AudioKey; voice: Voice } & (
      | { update: "StyleId" }
      | { update: "AccentPhrases"; accentPhrases: AccentPhrase[] }
      | { update: "AudioQuery"; query: AudioQuery }
    );
    action(payload: { audioKey: AudioKey; voice: Voice }): void;
  };

  COMMAND_CHANGE_ACCENT: {
    mutation: { audioKey: AudioKey; accentPhrases: AccentPhrase[] };
    action(payload: {
      audioKey: AudioKey;
      accentPhraseIndex: number;
      accent: number;
    }): void;
  };

  COMMAND_CHANGE_ACCENT_PHRASE_SPLIT: {
    mutation: { audioKey: AudioKey; accentPhrases: AccentPhrase[] };
    action(
      payload: { audioKey: AudioKey; accentPhraseIndex: number } & (
        | { isPause: false; moraIndex: number }
        | { isPause: true }
      )
    ): void;
  };

  COMMAND_CHANGE_SINGLE_ACCENT_PHRASE: {
    mutation: { audioKey: AudioKey; accentPhrases: AccentPhrase[] };
    action(payload: {
      audioKey: AudioKey;
      newPronunciation: string;
      accentPhraseIndex: number;
      popUntilPause: boolean;
    }): void;
  };

  COMMAND_RESET_MORA_PITCH_AND_LENGTH: {
    action(payload: { audioKey: AudioKey }): void;
  };

  COMMAND_RESET_SELECTED_MORA_PITCH_AND_LENGTH: {
    action(payload: { audioKey: AudioKey; accentPhraseIndex: number }): void;
  };

  COMMAND_SET_AUDIO_MORA_DATA: {
    mutation: {
      audioKey: AudioKey;
      accentPhraseIndex: number;
      moraIndex: number;
      data: number;
      type: MoraDataType;
    };
    action(payload: {
      audioKey: AudioKey;
      accentPhraseIndex: number;
      moraIndex: number;
      data: number;
      type: MoraDataType;
    }): void;
  };

  COMMAND_SET_AUDIO_MORA_DATA_ACCENT_PHRASE: {
    mutation: {
      audioKey: AudioKey;
      accentPhraseIndex: number;
      moraIndex: number;
      data: number;
      type: MoraDataType;
    };
    action(payload: {
      audioKey: AudioKey;
      accentPhraseIndex: number;
      moraIndex: number;
      data: number;
      type: MoraDataType;
    }): void;
  };

  COMMAND_SET_AUDIO_SPEED_SCALE: {
    mutation: { audioKey: AudioKey; speedScale: number };
    action(payload: { audioKey: AudioKey; speedScale: number }): void;
  };

  COMMAND_SET_AUDIO_PITCH_SCALE: {
    mutation: { audioKey: AudioKey; pitchScale: number };
    action(payload: { audioKey: AudioKey; pitchScale: number }): void;
  };

  COMMAND_SET_AUDIO_INTONATION_SCALE: {
    mutation: { audioKey: AudioKey; intonationScale: number };
    action(payload: { audioKey: AudioKey; intonationScale: number }): void;
  };

  COMMAND_SET_AUDIO_VOLUME_SCALE: {
    mutation: { audioKey: AudioKey; volumeScale: number };
    action(payload: { audioKey: AudioKey; volumeScale: number }): void;
  };

  COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH: {
    mutation: { audioKey: AudioKey; prePhonemeLength: number };
    action(payload: { audioKey: AudioKey; prePhonemeLength: number }): void;
  };

  COMMAND_SET_AUDIO_POST_PHONEME_LENGTH: {
    mutation: { audioKey: AudioKey; postPhonemeLength: number };
    action(payload: { audioKey: AudioKey; postPhonemeLength: number }): void;
  };

  COMMAND_SET_MORPHING_INFO: {
    mutation: {
      audioKey: AudioKey;
      morphingInfo: MorphingInfo | undefined;
    };
    action(payload: {
      audioKey: AudioKey;
      morphingInfo: MorphingInfo | undefined;
    }): void;
  };

  COMMAND_SET_AUDIO_PRESET: {
    mutation: {
      audioKey: AudioKey;
      presetKey: string | undefined;
    };
    action(payload: {
      audioKey: AudioKey;
      presetKey: string | undefined;
    }): void;
  };

  COMMAND_APPLY_AUDIO_PRESET: {
    mutation: { audioKey: AudioKey };
    action(payload: { audioKey: AudioKey }): void;
  };

  COMMAND_FULLY_APPLY_AUDIO_PRESET: {
    mutation: { presetKey: string };
    action(payload: { presetKey: string }): void;
  };

  COMMAND_IMPORT_FROM_FILE: {
    mutation: {
      audioKeyItemPairs: { audioItem: AudioItem; audioKey: AudioKey }[];
    };
    action(payload: { filePath?: string }): string[] | void;
  };

  COMMAND_PUT_TEXTS: {
    mutation: {
      audioKeyItemPairs: { audioItem: AudioItem; audioKey: AudioKey }[];
      prevAudioKey: AudioKey;
    };
    action(payload: {
      prevAudioKey: AudioKey;
      texts: string[];
      voice: Voice;
    }): AudioKey[];
  };
};

/*
 * Command Store Types
 */

export type CommandStoreState = {
  undoCommands: Command[];
  redoCommands: Command[];
};

export type CommandStoreTypes = {
  CAN_UNDO: {
    getter: boolean;
  };

  CAN_REDO: {
    getter: boolean;
  };

  UNDO: {
    mutation: undefined;
    action(): void;
  };

  REDO: {
    mutation: undefined;
    action(): void;
  };

  LAST_COMMAND_UNIX_MILLISEC: {
    getter: number | null;
  };

  CLEAR_COMMANDS: {
    mutation: undefined;
  };
};

/*
 * Engine Store Types
 */

export type EngineStoreState = {
  libraryInstallationState: LibraryInstallationState;
  engineStates: Record<EngineId, EngineState>;
  engineSupportedDevices: Record<EngineId, SupportedDevicesInfo>;
};

export type EngineStoreTypes = {
  GET_ENGINE_INFOS: {
    action(): void;
  };

  GET_SORTED_ENGINE_INFOS: {
    getter: EngineInfo[];
  };

  SET_ENGINE_MANIFESTS: {
    mutation: { engineManifests: Record<EngineId, EngineManifest> };
  };

  FETCH_AND_SET_ENGINE_MANIFESTS: {
    action(): void;
  };

  IS_ALL_ENGINE_READY: {
    getter: boolean;
  };

  IS_ENGINE_READY: {
    getter(engineId: EngineId): boolean;
  };

  START_WAITING_ENGINE: {
    action(payload: { engineId: EngineId }): void;
  };

  RESTART_ENGINES: {
    action(payload: { engineIds: EngineId[] }): Promise<{
      success: boolean;
      anyNewCharacters: boolean;
    }>;
  };

  POST_ENGINE_START: {
    action(payload: { engineIds: EngineId[] }): Promise<{
      success: boolean;
      anyNewCharacters: boolean;
    }>;
  };

  DETECTED_ENGINE_ERROR: {
    action(payload: { engineId: EngineId }): void;
  };

  OPEN_ENGINE_DIRECTORY: {
    action(payload: { engineId: EngineId }): void;
  };

  SET_ENGINE_STATE: {
    mutation: { engineId: EngineId; engineState: EngineState };
  };

  IS_INITIALIZED_ENGINE_SPEAKER: {
    action(payload: { engineId: EngineId; styleId: number }): Promise<boolean>;
  };

  INITIALIZE_ENGINE_SPEAKER: {
    action(payload: { engineId: EngineId; styleId: number }): void;
  };

  VALIDATE_ENGINE_DIR: {
    action(payload: { engineDir: string }): Promise<EngineDirValidationResult>;
  };

  ADD_ENGINE_DIR: {
    action(payload: { engineDir: string }): Promise<void>;
  };

  REMOVE_ENGINE_DIR: {
    action(payload: { engineDir: string }): Promise<void>;
  };

  INSTALL_VVPP_ENGINE: {
    action: (path: string) => Promise<boolean>;
  };

  UNINSTALL_VVPP_ENGINE: {
    action: (engineId: EngineId) => Promise<boolean>;
  };

  SET_ENGINE_INFOS: {
    mutation: { engineIds: EngineId[]; engineInfos: EngineInfo[] };
  };

  SET_ENGINE_MANIFEST: {
    mutation: { engineId: EngineId; engineManifest: EngineManifest };
  };

  FETCH_AND_SET_ENGINE_MANIFEST: {
    action(payload: { engineId: EngineId }): void;
  };

  SET_ENGINE_SUPPORTED_DEVICES: {
    mutation: { engineId: EngineId; supportedDevices: SupportedDevicesInfo };
  };

  FETCH_AND_SET_ENGINE_SUPPORTED_DEVICES: {
    action(payload: { engineId: EngineId }): void;
  };

  ENGINE_CAN_USE_GPU: {
    getter: (engineId: EngineId) => boolean;
  };
};

/*
 * Index Store Types
 */

export type IndexStoreState = {
  defaultStyleIds: DefaultStyleId[];
  userCharacterOrder: SpeakerId[];
  isMultiEngineOffMode: boolean;
};

export type IndexStoreTypes = {
  GET_ALL_CHARACTER_INFOS: {
    getter: Map<SpeakerId, CharacterInfo>;
  };

  GET_ORDERED_ALL_CHARACTER_INFOS: {
    getter: CharacterInfo[];
  };

  GET_HOW_TO_USE_TEXT: {
    action(): Promise<string>;
  };

  GET_CONTACT_TEXT: {
    action(): Promise<string>;
  };

  GET_Q_AND_A_TEXT: {
    action(): Promise<string>;
  };

  GET_POLICY_TEXT: {
    action(): Promise<string>;
  };

  GET_OSS_LICENSES: {
    action(): Promise<Record<string, string>[]>;
  };

  GET_UPDATE_INFOS: {
    action(): Promise<UpdateInfo[]>;
  };

  GET_OSS_COMMUNITY_INFOS: {
    action(): Promise<string>;
  };

  GET_PRIVACY_POLICY_TEXT: {
    action(): Promise<string>;
  };

  LOAD_DEFAULT_STYLE_IDS: {
    action(): Promise<void>;
  };

  SET_DEFAULT_STYLE_IDS: {
    mutation: { defaultStyleIds: DefaultStyleId[] };
    action(payload: DefaultStyleId[]): void;
  };

  LOAD_USER_CHARACTER_ORDER: {
    action(): Promise<void>;
  };

  SET_USER_CHARACTER_ORDER: {
    mutation: { userCharacterOrder: SpeakerId[] };
    action(payload: SpeakerId[]): void;
  };

  GET_NEW_CHARACTERS: {
    action(): SpeakerId[];
  };

  LOG_ERROR: {
    action(...payload: unknown[]): void;
  };

  LOG_WARN: {
    action(...payload: unknown[]): void;
  };

  LOG_INFO: {
    action(...payload: unknown[]): void;
  };

  INIT_VUEX: {
    action(): void;
  };

  SET_IS_MULTI_ENGINE_OFF_MODE: {
    mutation: { isMultiEngineOffMode: boolean };
    action(payload: boolean): void;
  };
};

/*
 * Project Store Types
 */

export type ProjectStoreState = {
  projectFilePath?: string;
  savedLastCommandUnixMillisec: number | null;
};

export type ProjectStoreTypes = {
  PROJECT_NAME: {
    getter: string | undefined;
  };

  SET_PROJECT_FILEPATH: {
    mutation: { filePath?: string };
  };

  CREATE_NEW_PROJECT: {
    action(payload: { confirm?: boolean }): void;
  };

  LOAD_PROJECT_FILE: {
    action(payload: { filePath?: string; confirm?: boolean }): boolean;
  };

  SAVE_PROJECT_FILE: {
    action(payload: { overwrite?: boolean }): void;
  };

  IS_EDITED: {
    getter: boolean;
  };

  SET_SAVED_LAST_COMMAND_UNIX_MILLISEC: {
    mutation: number | null;
  };
};

/*
 * Setting Store Types
 */

export type SettingStoreState = {
  savingSetting: SavingSetting;
  hotkeySettings: HotkeySetting[];
  toolbarSetting: ToolbarSetting;
  engineIds: EngineId[];
  engineInfos: Record<EngineId, EngineInfo>;
  engineManifests: Record<EngineId, EngineManifest>;
  themeSetting: ThemeSetting;
  editorFont: EditorFontType;
  acceptRetrieveTelemetry: AcceptRetrieveTelemetryStatus;
  experimentalSetting: ExperimentalSetting;
  splitTextWhenPaste: SplitTextWhenPasteType;
  splitterPosition: SplitterPosition;
  confirmedTips: ConfirmedTips;
  engineSettings: EngineSettings;
};

export type SettingStoreTypes = {
  HYDRATE_SETTING_STORE: {
    action(): void;
  };

  SET_SAVING_SETTING: {
    mutation: { savingSetting: SavingSetting };
    action(payload: { data: SavingSetting }): void;
  };

  SET_HOTKEY_SETTINGS: {
    mutation: { newHotkey: HotkeySetting };
    action(payload: { data: HotkeySetting }): void;
  };

  SET_TOOLBAR_SETTING: {
    mutation: { toolbarSetting: ToolbarSetting };
    action(payload: { data: ToolbarSetting }): void;
  };

  SET_THEME_SETTING: {
    mutation: { currentTheme: string; themes?: ThemeConf[] };
    action(payload: { currentTheme: string }): void;
  };

  SET_EDITOR_FONT: {
    mutation: { editorFont: EditorFontType };
    action(payload: { editorFont: EditorFontType }): void;
  };

  SET_ACCEPT_RETRIEVE_TELEMETRY: {
    mutation: { acceptRetrieveTelemetry: AcceptRetrieveTelemetryStatus };
    action(payload: {
      acceptRetrieveTelemetry: AcceptRetrieveTelemetryStatus;
    }): void;
  };

  SET_ACCEPT_TERMS: {
    mutation: { acceptTerms: AcceptTermsStatus };
    action(payload: { acceptTerms: AcceptTermsStatus }): void;
  };

  SET_EXPERIMENTAL_SETTING: {
    mutation: { experimentalSetting: ExperimentalSetting };
    action(payload: { experimentalSetting: ExperimentalSetting }): void;
  };

  SET_SPLIT_TEXT_WHEN_PASTE: {
    mutation: { splitTextWhenPaste: SplitTextWhenPasteType };
    action(payload: { splitTextWhenPaste: SplitTextWhenPasteType }): void;
  };

  SET_SPLITTER_POSITION: {
    mutation: { splitterPosition: SplitterPosition };
    action(payload: { splitterPosition: SplitterPosition }): void;
  };

  SET_CONFIRMED_TIPS: {
    mutation: { confirmedTips: ConfirmedTips };
    action(payload: { confirmedTips: ConfirmedTips }): void;
  };

  SET_ENGINE_SETTING: {
    mutation: { engineSetting: EngineSetting; engineId: EngineId };
    action(payload: {
      engineSetting: EngineSetting;
      engineId: EngineId;
    }): Promise<void>;
  };

  CHANGE_USE_GPU: {
    action(payload: { useGpu: boolean; engineId: EngineId }): Promise<void>;
  };
};

/*
 * Ui Store Types
 */

export type UiStoreState = {
  uiLockCount: number;
  dialogLockCount: number;
  inheritAudioInfo: boolean;
  activePointScrollMode: ActivePointScrollMode;
  isHelpDialogOpen: boolean;
  isSettingDialogOpen: boolean;
  isCharacterOrderDialogOpen: boolean;
  isDefaultStyleSelectDialogOpen: boolean;
  isHotkeySettingDialogOpen: boolean;
  isToolbarSettingDialogOpen: boolean;
  isAcceptRetrieveTelemetryDialogOpen: boolean;
  isAcceptTermsDialogOpen: boolean;
  isDictionaryManageDialogOpen: boolean;
  isEngineManageDialogOpen: boolean;
  isLibraryDownloadDialogOpen: boolean;
  isMaximized: boolean;
  isPinned: boolean;
  isFullscreen: boolean;
  progress: number;
};

export type UiStoreTypes = {
  UI_LOCKED: {
    getter: boolean;
  };

  MENUBAR_LOCKED: {
    getter: boolean;
  };

  PROGRESS: {
    getter: number;
  };

  ASYNC_UI_LOCK: {
    action(payload: { callback: () => Promise<void> }): void;
  };

  LOCK_UI: {
    mutation: undefined;
    action(): void;
  };

  UNLOCK_UI: {
    mutation: undefined;
    action(): void;
  };

  LOCK_MENUBAR: {
    mutation: undefined;
    action(): void;
  };

  UNLOCK_MENUBAR: {
    mutation: undefined;
    action(): void;
  };

  SHOULD_SHOW_PANES: {
    getter: boolean;
  };

  SET_DIALOG_OPEN: {
    mutation: {
      isDefaultStyleSelectDialogOpen?: boolean;
      isAcceptRetrieveTelemetryDialogOpen?: boolean;
      isAcceptTermsDialogOpen?: boolean;
      isDictionaryManageDialogOpen?: boolean;
      isHelpDialogOpen?: boolean;
      isSettingDialogOpen?: boolean;
      isHotkeySettingDialogOpen?: boolean;
      isToolbarSettingDialogOpen?: boolean;
      isCharacterOrderDialogOpen?: boolean;
      isEngineManageDialogOpen?: boolean;
      isLibraryDownloadDialogOpen?: boolean;
    };
    action(payload: {
      isDefaultStyleSelectDialogOpen?: boolean;
      isAcceptRetrieveTelemetryDialogOpen?: boolean;
      isAcceptTermsDialogOpen?: boolean;
      isDictionaryManageDialogOpen?: boolean;
      isHelpDialogOpen?: boolean;
      isSettingDialogOpen?: boolean;
      isHotkeySettingDialogOpen?: boolean;
      isToolbarSettingDialogOpen?: boolean;
      isCharacterOrderDialogOpen?: boolean;
      isEngineManageDialogOpen?: boolean;
      isLibraryDownloadDialogOpen?: boolean;
    }): void;
  };

  ON_VUEX_READY: {
    action(): void;
  };

  HYDRATE_UI_STORE: {
    action(): void;
  };

  SET_INHERIT_AUDIOINFO: {
    mutation: { inheritAudioInfo: boolean };
    action(payload: { inheritAudioInfo: boolean }): void;
  };

  SET_ACTIVE_POINT_SCROLL_MODE: {
    mutation: { activePointScrollMode: ActivePointScrollMode };
    action(payload: { activePointScrollMode: ActivePointScrollMode }): void;
  };

  DETECT_UNMAXIMIZED: {
    mutation: undefined;
    action(): void;
  };

  DETECT_MAXIMIZED: {
    mutation: undefined;
    action(): void;
  };

  DETECT_PINNED: {
    mutation: undefined;
    action(): void;
  };

  DETECT_UNPINNED: {
    mutation: undefined;
    action(): void;
  };

  DETECT_ENTER_FULLSCREEN: {
    mutation: undefined;
    action(): void;
  };

  DETECT_LEAVE_FULLSCREEN: {
    mutation: undefined;
    action(): void;
  };

  IS_FULLSCREEN: {
    getter: boolean;
  };

  CHECK_EDITED_AND_NOT_SAVE: {
    action(): Promise<void>;
  };

  RESTART_APP: {
    action(obj: { isMultiEngineOffMode?: boolean }): void;
  };

  START_PROGRESS: {
    action(): void;
  };

  SET_PROGRESS: {
    mutation: { progress: number };
    action(payload: { progress: number }): void;
  };

  SET_PROGRESS_FROM_COUNT: {
    action(payload: { finishedCount: number; totalCount: number }): void;
  };

  RESET_PROGRESS: {
    action(): void;
  };
};

/*
  Preset Store Types
*/

export type PresetStoreState = {
  presetKeys: string[];
  presetItems: Record<string, Preset>;
};

export type PresetStoreTypes = {
  SET_PRESET_ITEMS: {
    mutation: {
      presetItems: Record<string, Preset>;
    };
  };
  SET_PRESET_KEYS: {
    mutation: {
      presetKeys: string[];
    };
  };
  HYDRATE_PRESET_STORE: {
    action(): void;
  };
  SAVE_PRESET_ORDER: {
    action(payload: { presetKeys: string[] }): void;
  };
  SAVE_PRESET_CONFIG: {
    action(payload: {
      presetItems: Record<string, Preset>;
      presetKeys: string[];
    }): void;
  };
  ADD_PRESET: {
    action(payload: { presetData: Preset }): Promise<string>;
  };
  UPDATE_PRESET: {
    action(payload: { presetData: Preset; presetKey: string }): void;
  };
  DELETE_PRESET: {
    action(payload: { presetKey: string }): void;
  };
};

/*
 * Dictionary Store Types
 */

export type DictionaryStoreState = Record<string, unknown>;

export type DictionaryStoreTypes = {
  LOAD_USER_DICT: {
    action(payload: {
      engineId: EngineId;
    }): Promise<Record<string, UserDictWord>>;
  };
  LOAD_ALL_USER_DICT: {
    action(): Promise<Record<string, UserDictWord>>;
  };
  ADD_WORD: {
    action(payload: {
      surface: string;
      pronunciation: string;
      accentType: number;
      priority: number;
    }): Promise<void>;
  };
  REWRITE_WORD: {
    action(payload: {
      wordUuid: string;
      surface: string;
      pronunciation: string;
      accentType: number;
      priority: number;
    }): Promise<void>;
  };
  DELETE_WORD: {
    action(payload: { wordUuid: string }): Promise<void>;
  };
  SYNC_ALL_USER_DICT: {
    action(): Promise<void>;
  };
};

/*
 * Setting Store Types
 */

export type ProxyStoreState = Record<string, unknown>;

export type IEngineConnectorFactoryActions = ReturnType<
  IEngineConnectorFactory["instance"]
>;

type IEngineConnectorFactoryActionsMapper = <
  K extends keyof IEngineConnectorFactoryActions
>(
  action: K
) => (
  _: Parameters<IEngineConnectorFactoryActions[K]>[0]
) => ReturnType<IEngineConnectorFactoryActions[K]>;

export type ProxyStoreTypes = {
  INSTANTIATE_ENGINE_CONNECTOR: {
    action(payload: {
      engineId: EngineId;
    }): Promise<{ invoke: IEngineConnectorFactoryActionsMapper }>;
  };
};

/*
 * All Store Types
 */

export type State = AudioStoreState &
  AudioCommandStoreState &
  CommandStoreState &
  EngineStoreState &
  IndexStoreState &
  ProjectStoreState &
  SettingStoreState &
  UiStoreState &
  PresetStoreState &
  DictionaryStoreState &
  ProxyStoreState;

type AllStoreTypes = AudioStoreTypes &
  AudioCommandStoreTypes &
  CommandStoreTypes &
  EngineStoreTypes &
  IndexStoreTypes &
  ProjectStoreTypes &
  SettingStoreTypes &
  UiStoreTypes &
  PresetStoreTypes &
  DictionaryStoreTypes &
  ProxyStoreTypes;

export type AllGetters = StoreType<AllStoreTypes, "getter">;
export type AllMutations = StoreType<AllStoreTypes, "mutation">;
export type AllActions = StoreType<AllStoreTypes, "action">;

export const commandMutationsCreator = <S, M extends MutationsBase>(
  arg: PayloadRecipeTree<S, M>
): MutationTree<S, M> => createCommandMutationTree<S, M>(arg);

export const transformCommandStore = <
  S,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase
>(
  options: StoreOptions<S, G, A, M, AllGetters, AllActions, AllMutations>
): StoreOptions<S, G, A, M, AllGetters, AllActions, AllMutations> => {
  if (options.mutations)
    options.mutations = commandMutationsCreator<S, M>(
      options.mutations as PayloadRecipeTree<S, M>
    );
  return options;
};
