import {
  MutationTree,
  MutationsBase,
  GettersBase,
  ActionsBase,
  StoreOptions,
} from "./vuex";
import { Patch } from "immer";
import { AccentPhrase, AudioQuery } from "@/openapi";
import { createCommandMutationTree, PayloadRecipeTree } from "./command";
import {
  CharacterInfo,
  DefaultStyleId,
  Encoding as EncodingType,
  AcceptRetrieveTelemetryStatus,
  HotkeySetting,
  MoraDataType,
  SavingSetting,
  ThemeConf,
  ThemeSetting,
  ExperimentalSetting,
  ToolbarSetting,
  UpdateInfo,
  Preset,
  Engine,
} from "@/type/preload";
import { IEngineConnectorFactory } from "@/infrastructures/EngineConnector";
import { QVueGlobals } from "quasar";

export type AudioItem = {
  text: string;
  styleId?: number;
  query?: AudioQuery;
  presetKey?: string;
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
export type SaveResultObject = { result: SaveResult; path: string | undefined };

type StoreType<T, U extends "getter" | "mutation" | "action"> = {
  [P in keyof T as Extract<keyof T[P], U> extends never
    ? never
    : P]: T[P] extends {
    [K in U]: infer R;
  }
    ? R
    : never;
};

export type QuasarDialog = QVueGlobals["dialog"];

/*
 * Audio Store Types
 */

export type AudioStoreState = {
  engineState: EngineState;
  characterInfos?: CharacterInfo[];
  audioItems: Record<string, AudioItem>;
  audioKeys: string[];
  audioStates: Record<string, AudioState>;
  _activeAudioKey?: string;
  nowPlayingContinuously: boolean;
};

type AudioStoreTypes = {
  ACTIVE_AUDIO_KEY: {
    getter: string | undefined;
  };

  HAVE_AUDIO_QUERY: {
    getter(audioKey: string): boolean;
  };

  IS_ACTIVE: {
    getter(audioKey: string): boolean;
  };

  IS_ENGINE_READY: {
    getter: boolean;
  };

  START_WAITING_ENGINE: {
    action(): void;
  };

  RESTART_ENGINE: {
    action(): void;
  };

  DETECTED_ENGINE_ERROR: {
    action(): void;
  };

  SET_ENGINE_STATE: {
    mutation: { engineState: EngineState };
  };

  LOAD_CHARACTER: {
    action(): void;
  };

  SET_CHARACTER_INFOS: {
    mutation: { characterInfos: CharacterInfo[] };
  };

  GENERATE_AUDIO_KEY: {
    action(): string;
  };

  SET_ACTIVE_AUDIO_KEY: {
    mutation: { audioKey?: string };
    action(payload: { audioKey?: string }): void;
  };

  SET_AUDIO_NOW_PLAYING: {
    mutation: { audioKey: string; nowPlaying: boolean };
  };

  SET_AUDIO_NOW_GENERATING: {
    mutation: { audioKey: string; nowGenerating: boolean };
  };

  SET_NOW_PLAYING_CONTINUOUSLY: {
    mutation: { nowPlaying: boolean };
  };

  GENERATE_AUDIO_ITEM: {
    action(payload: {
      text?: string;
      styleId?: number;
      presetKey?: string;
      baseAudioItem?: AudioItem;
    }): Promise<AudioItem>;
  };

  REGISTER_AUDIO_ITEM: {
    action(payload: {
      audioItem: AudioItem;
      prevAudioKey?: string;
    }): Promise<string>;
  };

  INSERT_AUDIO_ITEM: {
    mutation: {
      audioItem: AudioItem;
      audioKey: string;
      prevAudioKey: string | undefined;
    };
  };

  INSERT_AUDIO_ITEMS: {
    mutation: {
      audioKeyItemPairs: { audioItem: AudioItem; audioKey: string }[];
      prevAudioKey: string | undefined;
    };
  };

  REMOVE_AUDIO_ITEM: {
    mutation: { audioKey: string };
  };

  SET_AUDIO_KEYS: {
    mutation: { audioKeys: string[] };
  };

  REMOVE_ALL_AUDIO_ITEM: {
    action(): void;
  };

  GET_AUDIO_CACHE: {
    action(payload: { audioKey: string }): Promise<Blob | null>;
  };

  SET_AUDIO_TEXT: {
    mutation: { audioKey: string; text: string };
  };

  SET_AUDIO_SPEED_SCALE: {
    mutation: { audioKey: string; speedScale: number };
  };

  SET_AUDIO_PITCH_SCALE: {
    mutation: { audioKey: string; pitchScale: number };
  };

  SET_AUDIO_INTONATION_SCALE: {
    mutation: { audioKey: string; intonationScale: number };
  };

  SET_AUDIO_VOLUME_SCALE: {
    mutation: { audioKey: string; volumeScale: number };
  };

  SET_AUDIO_PRE_PHONEME_LENGTH: {
    mutation: { audioKey: string; prePhonemeLength: number };
  };

  SET_AUDIO_POST_PHONEME_LENGTH: {
    mutation: { audioKey: string; postPhonemeLength: number };
  };

  SET_AUDIO_QUERY: {
    mutation: { audioKey: string; audioQuery: AudioQuery };
    action(payload: { audioKey: string; audioQuery: AudioQuery }): void;
  };

  FETCH_AUDIO_QUERY: {
    action(payload: { text: string; styleId: number }): Promise<AudioQuery>;
  };

  SET_AUDIO_STYLE_ID: {
    mutation: { audioKey: string; styleId: number };
  };

  SET_ACCENT_PHRASES: {
    mutation: { audioKey: string; accentPhrases: AccentPhrase[] };
  };

  FETCH_ACCENT_PHRASES: {
    action(payload: {
      text: string;
      styleId: number;
      isKana?: boolean;
    }): Promise<AccentPhrase[]>;
  };

  SET_SINGLE_ACCENT_PHRASE: {
    mutation: {
      audioKey: string;
      accentPhraseIndex: number;
      accentPhrases: AccentPhrase[];
    };
  };

  SET_AUDIO_MORA_DATA: {
    mutation: {
      audioKey: string;
      accentPhraseIndex: number;
      moraIndex: number;
      data: number;
      type: MoraDataType;
    };
  };

  APPLY_AUDIO_PRESET: {
    mutation: { audioKey: string };
  };

  FETCH_MORA_DATA: {
    action(payload: {
      accentPhrases: AccentPhrase[];
      styleId: number;
    }): Promise<AccentPhrase[]>;
  };

  FETCH_AND_COPY_MORA_DATA: {
    action(payload: {
      accentPhrases: AccentPhrase[];
      styleId: number;
      copyIndexes: number[];
    }): Promise<AccentPhrase[]>;
  };

  GENERATE_LAB: {
    action(payload: { audioKey: string; offset?: number }): string | undefined;
  };

  GENERATE_AUDIO: {
    action(payload: { audioKey: string }): Blob | null;
  };

  CONNECT_AUDIO: {
    action(payload: { encodedBlobs: string[] }): Blob | null;
  };

  GENERATE_AND_SAVE_AUDIO: {
    action(payload: {
      audioKey: string;
      filePath?: string;
      encoding?: EncodingType;
    }): SaveResultObject;
  };

  GENERATE_AND_SAVE_ALL_AUDIO: {
    action(payload: {
      dirPath?: string;
      encoding?: EncodingType;
    }): SaveResultObject[] | undefined;
  };

  GENERATE_AND_CONNECT_AND_SAVE_AUDIO: {
    action(payload: {
      filePath?: string;
      encoding?: EncodingType;
    }): SaveResultObject | undefined;
  };

  PLAY_AUDIO: {
    action(payload: { audioKey: string }): boolean;
  };

  STOP_AUDIO: {
    action(payload: { audioKey: string }): void;
  };

  SET_AUDIO_PRESET: {
    mutation: {
      audioKey: string;
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

export type AudioGetters = StoreType<AudioStoreTypes, "getter">;
export type AudioMutations = StoreType<AudioStoreTypes, "mutation">;
export type AudioActions = StoreType<AudioStoreTypes, "action">;

/*
 * Audio Command Store Types
 */

export type AudioCommandStoreState = {
  //
};

type AudioCommandStoreTypes = {
  COMMAND_REGISTER_AUDIO_ITEM: {
    mutation: {
      audioItem: AudioItem;
      audioKey: string;
      prevAudioKey: string | undefined;
    };
    action(payload: {
      audioItem: AudioItem;
      prevAudioKey: string | undefined;
    }): Promise<string>;
  };

  COMMAND_REMOVE_AUDIO_ITEM: {
    mutation: { audioKey: string };
    action(payload: { audioKey: string }): void;
  };

  COMMAND_SET_AUDIO_KEYS: {
    mutation: { audioKeys: string[] };
    action(payload: { audioKeys: string[] }): void;
  };

  COMMAND_CHANGE_AUDIO_TEXT: {
    mutation: { audioKey: string; text: string } & (
      | { update: "Text" }
      | { update: "AccentPhrases"; accentPhrases: AccentPhrase[] }
      | { update: "AudioQuery"; query: AudioQuery }
    );
    action(payload: { audioKey: string; text: string }): void;
  };

  COMMAND_CHANGE_STYLE_ID: {
    mutation: { styleId: number; audioKey: string } & (
      | { update: "StyleId" }
      | { update: "AccentPhrases"; accentPhrases: AccentPhrase[] }
      | { update: "AudioQuery"; query: AudioQuery }
    );
    action(payload: { audioKey: string; styleId: number }): void;
  };

  COMMAND_CHANGE_ACCENT: {
    mutation: { audioKey: string; accentPhrases: AccentPhrase[] };
    action(payload: {
      audioKey: string;
      accentPhraseIndex: number;
      accent: number;
    }): void;
  };

  COMMAND_CHANGE_ACCENT_PHRASE_SPLIT: {
    mutation: { audioKey: string; accentPhrases: AccentPhrase[] };
    action(
      payload: { audioKey: string; accentPhraseIndex: number } & (
        | { isPause: false; moraIndex: number }
        | { isPause: true }
      )
    ): void;
  };

  COMMAND_CHANGE_SINGLE_ACCENT_PHRASE: {
    mutation: { audioKey: string; accentPhrases: AccentPhrase[] };
    action(payload: {
      audioKey: string;
      newPronunciation: string;
      accentPhraseIndex: number;
      popUntilPause: boolean;
    }): void;
  };

  COMMAND_SET_AUDIO_MORA_DATA: {
    mutation: {
      audioKey: string;
      accentPhraseIndex: number;
      moraIndex: number;
      data: number;
      type: MoraDataType;
    };
    action(payload: {
      audioKey: string;
      accentPhraseIndex: number;
      moraIndex: number;
      data: number;
      type: MoraDataType;
    }): void;
  };

  COMMAND_SET_AUDIO_SPEED_SCALE: {
    mutation: { audioKey: string; speedScale: number };
    action(payload: { audioKey: string; speedScale: number }): void;
  };

  COMMAND_SET_AUDIO_PITCH_SCALE: {
    mutation: { audioKey: string; pitchScale: number };
    action(payload: { audioKey: string; pitchScale: number }): void;
  };

  COMMAND_SET_AUDIO_INTONATION_SCALE: {
    mutation: { audioKey: string; intonationScale: number };
    action(payload: { audioKey: string; intonationScale: number }): void;
  };

  COMMAND_SET_AUDIO_VOLUME_SCALE: {
    mutation: { audioKey: string; volumeScale: number };
    action(payload: { audioKey: string; volumeScale: number }): void;
  };

  COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH: {
    mutation: { audioKey: string; prePhonemeLength: number };
    action(payload: { audioKey: string; prePhonemeLength: number }): void;
  };

  COMMAND_SET_AUDIO_POST_PHONEME_LENGTH: {
    mutation: { audioKey: string; postPhonemeLength: number };
    action(payload: { audioKey: string; postPhonemeLength: number }): void;
  };

  COMMAND_SET_AUDIO_PRESET: {
    mutation: {
      audioKey: string;
      presetKey: string | undefined;
    };
    action(payload: { audioKey: string; presetKey: string | undefined }): void;
  };

  COMMAND_APPLY_AUDIO_PRESET: {
    mutation: { audioKey: string };
    action(payload: { audioKey: string }): void;
  };

  COMMAND_FULLY_APPLY_AUDIO_PRESET: {
    mutation: { presetKey: string };
    action(payload: { presetKey: string }): void;
  };

  COMMAND_IMPORT_FROM_FILE: {
    mutation: {
      audioKeyItemPairs: { audioItem: AudioItem; audioKey: string }[];
    };
    action(payload: { filePath?: string }): string[] | void;
  };

  COMMAND_PUT_TEXTS: {
    mutation: {
      audioKeyItemPairs: { audioItem: AudioItem; audioKey: string }[];
      prevAudioKey: string;
    };
    action(payload: {
      prevAudioKey: string;
      texts: string[];
      styleId: number;
    }): string[];
  };
};

export type AudioCommandGetters = StoreType<AudioCommandStoreTypes, "getter">;
export type AudioCommandMutations = StoreType<
  AudioCommandStoreTypes,
  "mutation"
>;
export type AudioCommandActions = StoreType<AudioCommandStoreTypes, "action">;

/*
 * Command Store Types
 */

export type CommandStoreState = {
  undoCommands: Command[];
  redoCommands: Command[];
};

type CommandStoreTypes = {
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

export type CommandGetters = StoreType<CommandStoreTypes, "getter">;
export type CommandMutations = StoreType<CommandStoreTypes, "mutation">;
export type CommandActions = StoreType<CommandStoreTypes, "action">;

/*
 * Index Store Types
 */

export type IndexStoreState = {
  defaultStyleIds: DefaultStyleId[];
};

type IndexStoreTypes = {
  GET_HOW_TO_USE_TEXT: {
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

  IS_UNSET_DEFAULT_STYLE_ID: {
    action(payload: { speakerUuid: string }): Promise<boolean>;
  };

  LOAD_DEFAULT_STYLE_IDS: {
    action(): Promise<void>;
  };

  SET_DEFAULT_STYLE_IDS: {
    mutation: { defaultStyleIds: DefaultStyleId[] };
    action(payload: DefaultStyleId[]): void;
  };

  SHOW_WARNING_DIALOG: {
    action(payload: {
      title: string;
      message: string;
    }): Promise<Electron.MessageBoxReturnValue>;
  };

  LOG_ERROR: {
    action(...payload: unknown[]): void;
  };

  LOG_INFO: {
    action(...payload: unknown[]): void;
  };

  INIT_VUEX: {
    action(): void;
  };
};

export type IndexGetters = StoreType<IndexStoreTypes, "getter">;
export type IndexMutations = StoreType<IndexStoreTypes, "mutation">;
export type IndexActions = StoreType<IndexStoreTypes, "action">;

/*
 * Project Store Types
 */

export type ProjectStoreState = {
  projectFilePath?: string;
  savedLastCommandUnixMillisec: number | null;
};

type ProjectStoreTypes = {
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
    action(payload: { filePath?: string; confirm?: boolean }): void;
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

export type ProjectGetters = StoreType<ProjectStoreTypes, "getter">;
export type ProjectMutations = StoreType<ProjectStoreTypes, "mutation">;
export type ProjectActions = StoreType<ProjectStoreTypes, "action">;

/*
 * Setting Store Types
 */

export type SettingStoreState = {
  savingSetting: SavingSetting;
  hotkeySettings: HotkeySetting[];
  toolbarSetting: ToolbarSetting;
  engines: Engine[];
  themeSetting: ThemeSetting;
  acceptRetrieveTelemetry: AcceptRetrieveTelemetryStatus;
  experimentalSetting: ExperimentalSetting;
};

type SettingStoreTypes = {
  GET_SAVING_SETTING: {
    getter: SavingSetting;
    action(): void;
  };

  SET_SAVING_SETTING: {
    mutation: { savingSetting: SavingSetting };
    action(payload: { data: SavingSetting }): void;
  };

  GET_HOTKEY_SETTINGS: {
    action(): void;
  };

  SET_HOTKEY_SETTINGS: {
    mutation: { newHotkey: HotkeySetting };
    action(payload: { data: HotkeySetting }): void;
  };

  GET_TOOLBAR_SETTING: {
    action(): void;
  };

  SET_TOOLBAR_SETTING: {
    mutation: { toolbarSetting: ToolbarSetting };
    action(payload: { data: ToolbarSetting }): void;
  };

  GET_THEME_SETTING: {
    action(): void;
  };

  SET_THEME_SETTING: {
    mutation: { currentTheme: string; themes?: ThemeConf[] };
    action(payload: { currentTheme: string }): void;
  };

  GET_ACCEPT_RETRIEVE_TELEMETRY: {
    action(): void;
  };

  SET_ACCEPT_RETRIEVE_TELEMETRY: {
    mutation: { acceptRetrieveTelemetry: AcceptRetrieveTelemetryStatus };
    action(payload: {
      acceptRetrieveTelemetry: AcceptRetrieveTelemetryStatus;
    }): void;
  };

  GET_EXPERIMENTAL_SETTING: {
    action(): void;
  };

  SET_EXPERIMENTAL_SETTING: {
    mutation: { experimentalSetting: ExperimentalSetting };
    action(payload: { experimentalSetting: ExperimentalSetting }): void;
  };
};

export type SettingGetters = StoreType<SettingStoreTypes, "getter">;
export type SettingMutations = StoreType<SettingStoreTypes, "mutation">;
export type SettingActions = StoreType<SettingStoreTypes, "action">;

/*
 * Ui Store Types
 */

export type UiStoreState = {
  uiLockCount: number;
  dialogLockCount: number;
  useGpu: boolean;
  inheritAudioInfo: boolean;
  isHelpDialogOpen: boolean;
  isSettingDialogOpen: boolean;
  isDefaultStyleSelectDialogOpen: boolean;
  isHotkeySettingDialogOpen: boolean;
  isAcceptRetrieveTelemetryDialogOpen: boolean;
  isMaximized: boolean;
  isPinned: boolean;
  isFullscreen: boolean;
};

type UiStoreTypes = {
  UI_LOCKED: {
    getter: boolean;
  };

  MENUBAR_LOCKED: {
    getter: boolean;
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

  IS_HELP_DIALOG_OPEN: {
    mutation: { isHelpDialogOpen: boolean };
    action(payload: { isHelpDialogOpen: boolean }): void;
  };

  IS_SETTING_DIALOG_OPEN: {
    mutation: { isSettingDialogOpen: boolean };
    action(payload: { isSettingDialogOpen: boolean }): void;
  };

  IS_HOTKEY_SETTING_DIALOG_OPEN: {
    mutation: { isHotkeySettingDialogOpen: boolean };
    action(payload: { isHotkeySettingDialogOpen: boolean }): void;
  };

  IS_ACCEPT_RETRIEVE_TELEMETRY_DIALOG_OPEN: {
    mutation: { isAcceptRetrieveTelemetryDialogOpen: boolean };
    action(payload: { isAcceptRetrieveTelemetryDialogOpen: boolean }): void;
  };

  ON_VUEX_READY: {
    action(): void;
  };

  IS_DEFAULT_STYLE_SELECT_DIALOG_OPEN: {
    mutation: { isDefaultStyleSelectDialogOpen: boolean };
    action(payload: { isDefaultStyleSelectDialogOpen: boolean }): void;
  };

  GET_USE_GPU: {
    action(): void;
  };

  SET_USE_GPU: {
    mutation: { useGpu: boolean };
    action(payload: { useGpu: boolean }): void;
  };

  GET_ENGINES: {
    action(): void;
  };

  SET_ENGINES: { mutation: { engines: Engine[] } };

  GET_INHERIT_AUDIOINFO: {
    action(): void;
  };

  SET_INHERIT_AUDIOINFO: {
    mutation: { inheritAudioInfo: boolean };
    action(payload: { inheritAudioInfo: boolean }): void;
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
};

export type UiGetters = StoreType<UiStoreTypes, "getter">;
export type UiMutations = StoreType<UiStoreTypes, "mutation">;
export type UiActions = StoreType<UiStoreTypes, "action">;

/*
  Preset Store Types
*/

export type PresetStoreState = {
  presetKeys: string[];
  presetItems: Record<string, Preset>;
};

type PresetStoreTypes = {
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
  GET_PRESET_CONFIG: {
    action(): void;
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

export type PresetGetters = StoreType<PresetStoreTypes, "getter">;
export type PresetMutations = StoreType<PresetStoreTypes, "mutation">;
export type PresetActions = StoreType<PresetStoreTypes, "action">;

/*
 * Setting Store Types
 */

export type ProxyStoreState = Record<string, unknown>;

export type IEngineConnectorFactoryActions = ReturnType<
  IEngineConnectorFactory["instance"]
>;

type IEngineConnectorFactoryActionsMapper<K> =
  K extends keyof IEngineConnectorFactoryActions
    ? (payload: {
        host: string;
        action: K;
        payload: Parameters<IEngineConnectorFactoryActions[K]>;
      }) => ReturnType<IEngineConnectorFactoryActions[K]>
    : never;

type ProxyStoreTypes = {
  INVOKE_ENGINE_CONNECTOR: {
    // FIXME: actionに対してIEngineConnectorFactoryActionsのUnion型を与えているため、actionとpayloadが与えられるとReturnValueの型が得られる
    // しかしVuexの型を通すとReturnValueの型付けが行われなくなりPromise<any>に落ちてしまうため、明示的な型付けを行う必要がある
    action: IEngineConnectorFactoryActionsMapper<
      keyof IEngineConnectorFactoryActions
    >;
  };
};

export type ProxyGetters = StoreType<ProxyStoreTypes, "getter">;
export type ProxyMutations = StoreType<ProxyStoreTypes, "mutation">;
export type ProxyActions = StoreType<ProxyStoreTypes, "action">;

/*
 * All Store Types
 */

export type State = AudioStoreState &
  AudioCommandStoreState &
  CommandStoreState &
  IndexStoreState &
  ProjectStoreState &
  SettingStoreState &
  UiStoreState &
  PresetStoreState &
  ProxyStoreState;

type AllStoreTypes = AudioStoreTypes &
  AudioCommandStoreTypes &
  CommandStoreTypes &
  IndexStoreTypes &
  ProjectStoreTypes &
  SettingStoreTypes &
  UiStoreTypes &
  PresetStoreTypes &
  ProxyStoreTypes;

export type AllGetters = StoreType<AllStoreTypes, "getter">;
export type AllMutations = StoreType<AllStoreTypes, "mutation">;
export type AllActions = StoreType<AllStoreTypes, "action">;

export type VoiceVoxStoreOptions<
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase
> = StoreOptions<State, G, A, M, AllGetters, AllActions, AllMutations>;

export const commandMutationsCreator = <M extends MutationsBase>(
  arg: PayloadRecipeTree<State, M>
): MutationTree<State, M> => createCommandMutationTree<State, M>(arg);
