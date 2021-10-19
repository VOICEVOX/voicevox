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
  Encoding as EncodingType,
  HotkeySetting,
  SavingSetting,
  UpdateInfo,
} from "@/type/preload";

export type State = {
  engineState: EngineState;
  characterInfos?: CharacterInfo[];
  audioItems: Record<string, AudioItem>;
  audioKeys: string[];
  audioStates: Record<string, AudioState>;
  _activeAudioKey?: string;
  uiLockCount: number;
  audioDetailPaneOffset?: number;
  audioInfoPaneOffset?: number;
  nowPlayingContinuously: boolean;
  undoCommands: Command[];
  redoCommands: Command[];
  useUndoRedo: boolean;
  useGpu: boolean;
  isHelpDialogOpen: boolean;
  isSettingDialogOpen: boolean;
  isMaximized: boolean;
  projectFilePath?: string;
  savedLastCommandUnixMillisec: number | null;
  savingSetting: SavingSetting;
  hotkeySettings: HotkeySetting[];
  isPinned: boolean;
};

export type AudioItem = {
  text: string;
  styleId?: number;
  query?: AudioQuery;
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

/*
 * Audio Store Types
 */

export type AudioGetters = {
  ACTIVE_AUDIO_KEY: string | undefined;
  HAVE_AUDIO_QUERY: (audioKey: string) => boolean;
  IS_ACTIVE: (audioKey: string) => boolean;
  IS_ENGINE_READY: boolean;
};

export type AudioMutations = {
  SET_ENGINE_STATE: { engineState: EngineState };
  SET_CHARACTER_INFOS: { characterInfos: CharacterInfo[] };
  SET_ACTIVE_AUDIO_KEY: { audioKey?: string };
  SET_AUDIO_NOW_PLAYING: { audioKey: string; nowPlaying: boolean };
  SET_AUDIO_NOW_GENERATING: {
    audioKey: string;
    nowGenerating: boolean;
  };
  SET_NOW_PLAYING_CONTINUOUSLY: { nowPlaying: boolean };
  INSERT_AUDIO_ITEM: {
    audioItem: AudioItem;
    audioKey: string;
    prevAudioKey: string | undefined;
  };
  INSERT_AUDIO_ITEMS: {
    audioKeyItemPairs: { audioItem: AudioItem; audioKey: string }[];
    prevAudioKey: string | undefined;
  };
  REMOVE_AUDIO_ITEM: { audioKey: string };
  SET_AUDIO_TEXT: { audioKey: string; text: string };
  SET_AUDIO_SPEED_SCALE: { audioKey: string; speedScale: number };
  SET_AUDIO_PITCH_SCALE: { audioKey: string; pitchScale: number };
  SET_AUDIO_INTONATION_SCALE: { audioKey: string; intonationScale: number };
  SET_AUDIO_VOLUME_SCALE: { audioKey: string; volumeScale: number };
  SET_AUDIO_PRE_PHONEME_LENGTH: { audioKey: string; prePhonemeLength: number };
  SET_AUDIO_POST_PHONEME_LENGTH: {
    audioKey: string;
    postPhonemeLength: number;
  };
  SET_AUDIO_QUERY: { audioKey: string; audioQuery: AudioQuery };
  SET_AUDIO_STYLE_ID: { audioKey: string; styleId: number };
  SET_ACCENT_PHRASES: { audioKey: string; accentPhrases: AccentPhrase[] };
  SET_SINGLE_ACCENT_PHRASE: {
    audioKey: string;
    accentPhraseIndex: number;
    accentPhrases: AccentPhrase[];
  };
  SET_AUDIO_MORA_DATA: {
    audioKey: string;
    accentPhraseIndex: number;
    moraIndex: number;
    data: number;
    type: string;
  };
};

export type AudioActions = {
  START_WAITING_ENGINE(): void;
  LOAD_CHARACTER(): void;
  REMOVE_ALL_AUDIO_ITEM(): void;
  GENERATE_AUDIO_KEY(): string;
  GENERATE_AUDIO_ITEM(payload: {
    text?: string;
    styleId?: number;
  }): Promise<AudioItem>;
  REGISTER_AUDIO_ITEM(payload: {
    audioItem: AudioItem;
    prevAudioKey?: string;
  }): Promise<string>;
  SET_ACTIVE_AUDIO_KEY(payload: { audioKey?: string }): void;
  GET_AUDIO_CACHE(payload: { audioKey: string }): Promise<Blob | null>;
  SET_AUDIO_QUERY(payload: { audioKey: string; audioQuery: AudioQuery }): void;
  FETCH_ACCENT_PHRASES(payload: {
    text: string;
    styleId: number;
    isKana?: boolean;
  }): Promise<AccentPhrase[]>;
  FETCH_MORA_DATA(payload: {
    accentPhrases: AccentPhrase[];
    styleId: number;
  }): Promise<AccentPhrase[]>;
  FETCH_AND_COPY_MORA_DATA(payload: {
    accentPhrases: AccentPhrase[];
    styleId: number;
    copyIndexes: number[];
  }): Promise<AccentPhrase[]>;
  FETCH_AUDIO_QUERY(payload: {
    text: string;
    styleId: number;
  }): Promise<AudioQuery>;
  FETCH_AND_SET_AUDIO_QUERY(payload: { audioKey: string }): void;
  GENERATE_AUDIO(payload: { audioKey: string }): Blob | null;
  GENERATE_AND_SAVE_AUDIO(payload: {
    audioKey: string;
    filePath?: string;
    encoding?: EncodingType;
  }): SaveResultObject;
  GENERATE_AND_SAVE_ALL_AUDIO(payload: {
    dirPath?: string;
    encoding?: EncodingType;
  }): SaveResultObject[] | undefined;
  PLAY_AUDIO(payload: { audioKey: string }): boolean;
  STOP_AUDIO(payload: { audioKey: string }): void;
  PLAY_CONTINUOUSLY_AUDIO(): void;
  STOP_CONTINUOUSLY_AUDIO(): void;
  OPEN_TEXT_EDIT_CONTEXT_MENU(): void;
  DETECTED_ENGINE_ERROR(): void;
  RESTART_ENGINE(): void;
  CHECK_FILE_EXISTS(payload: { file: string }): Promise<boolean>;
};

/*
 * Audio Command Store Types
 */

// eslint-disable-next-line @typescript-eslint/ban-types
export type AudioCommandGetters = {};

export type AudioCommandActions = {
  COMMAND_REGISTER_AUDIO_ITEM(payload: {
    audioItem: AudioItem;
    prevAudioKey: string | undefined;
  }): Promise<string>;
  COMMAND_REMOVE_AUDIO_ITEM(payload: { audioKey: string }): void;
  COMMAND_CHANGE_AUDIO_TEXT(payload: { audioKey: string; text: string }): void;
  COMMAND_CHANGE_STYLE_ID(payload: { audioKey: string; styleId: number }): void;
  COMMAND_CHANGE_ACCENT(payload: {
    audioKey: string;
    accentPhraseIndex: number;
    accent: number;
  }): void;
  COMMAND_CHANGE_ACCENT_PHRASE_SPLIT(
    payload: {
      audioKey: string;
      accentPhraseIndex: number;
    } & (
      | {
          isPause: false;
          moraIndex: number;
        }
      | {
          isPause: true;
        }
    )
  ): void;
  COMMAND_CHANGE_SINGLE_ACCENT_PHRASE(payload: {
    audioKey: string;
    newPronunciation: string;
    accentPhraseIndex: number;
    popUntilPause: boolean;
  }): void;
  COMMAND_SET_AUDIO_MORA_DATA(payload: {
    audioKey: string;
    accentPhraseIndex: number;
    moraIndex: number;
    data: number;
    type: string;
  }): void;
  COMMAND_SET_AUDIO_SPEED_SCALE(payload: {
    audioKey: string;
    speedScale: number;
  }): void;
  COMMAND_SET_AUDIO_PITCH_SCALE(payload: {
    audioKey: string;
    pitchScale: number;
  }): void;
  COMMAND_SET_AUDIO_INTONATION_SCALE(payload: {
    audioKey: string;
    intonationScale: number;
  }): void;
  COMMAND_SET_AUDIO_VOLUME_SCALE(payload: {
    audioKey: string;
    volumeScale: number;
  }): void;
  COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH(payload: {
    audioKey: string;
    prePhonemeLength: number;
  }): void;
  COMMAND_SET_AUDIO_POST_PHONEME_LENGTH(payload: {
    audioKey: string;
    postPhonemeLength: number;
  }): void;
  COMMAND_IMPORT_FROM_FILE(payload: { filePath?: string }): string[] | void;
  COMMAND_PUT_TEXTS(payload: {
    prevAudioKey: string;
    texts: string[];
    styleId: number;
  }): string[];
};

export type AudioCommandMutations = {
  COMMAND_REGISTER_AUDIO_ITEM: {
    audioItem: AudioItem;
    audioKey: string;
    prevAudioKey: string | undefined;
  };
  COMMAND_REMOVE_AUDIO_ITEM: { audioKey: string };
  COMMAND_CHANGE_AUDIO_TEXT: { audioKey: string; text: string } & (
    | {
        update: "Text";
      }
    | {
        update: "AccentPhrases";
        accentPhrases: AccentPhrase[];
      }
    | {
        update: "AudioQuery";
        query: AudioQuery;
      }
  );
  COMMAND_CHANGE_STYLE_ID: {
    styleId: number;
    audioKey: string;
  } & (
    | {
        update: "StyleId";
      }
    | {
        update: "AccentPhrases";
        accentPhrases: AccentPhrase[];
      }
    | {
        update: "AudioQuery";
        query: AudioQuery;
      }
  );
  COMMAND_CHANGE_ACCENT: {
    audioKey: string;
    accentPhrases: AccentPhrase[];
  };
  COMMAND_CHANGE_ACCENT_PHRASE_SPLIT: {
    audioKey: string;
    accentPhrases: AccentPhrase[];
  };
  COMMAND_CHANGE_SINGLE_ACCENT_PHRASE: {
    audioKey: string;
    accentPhrases: AccentPhrase[];
  };
  COMMAND_SET_AUDIO_MORA_DATA: {
    audioKey: string;
    accentPhraseIndex: number;
    moraIndex: number;
    data: number;
    type: string;
  };
  COMMAND_SET_AUDIO_SPEED_SCALE: { audioKey: string; speedScale: number };
  COMMAND_SET_AUDIO_PITCH_SCALE: { audioKey: string; pitchScale: number };
  COMMAND_SET_AUDIO_INTONATION_SCALE: {
    audioKey: string;
    intonationScale: number;
  };
  COMMAND_SET_AUDIO_VOLUME_SCALE: { audioKey: string; volumeScale: number };
  COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH: {
    audioKey: string;
    prePhonemeLength: number;
  };
  COMMAND_SET_AUDIO_POST_PHONEME_LENGTH: {
    audioKey: string;
    postPhonemeLength: number;
  };
  COMMAND_IMPORT_FROM_FILE: {
    audioKeyItemPairs: { audioItem: AudioItem; audioKey: string }[];
  };
  COMMAND_PUT_TEXTS: {
    audioKeyItemPairs: { audioItem: AudioItem; audioKey: string }[];
    prevAudioKey: string;
  };
};

/*
 * Command Store Types
 */

export type CommandGetters = {
  CAN_UNDO: boolean;
  CAN_REDO: boolean;
  LAST_COMMAND_UNIX_MILLISEC: number | null;
};

export type CommandMutations = {
  UNDO: undefined;
  REDO: undefined;
  CLEAR_COMMANDS: undefined;
};

export type CommandActions = {
  UNDO(): void;
  REDO(): void;
};

/*
 * Index Store Types
 */

// eslint-disable-next-line @typescript-eslint/ban-types
export type IndexGetters = {};

// eslint-disable-next-line @typescript-eslint/ban-types
export type IndexMutations = {};

export type IndexActions = {
  GET_HOW_TO_USE_TEXT(): Promise<string>;
  GET_POLICY_TEXT(): Promise<string>;
  GET_OSS_LICENSES(): Promise<Record<string, string>[]>;
  GET_UPDATE_INFOS(): Promise<UpdateInfo[]>;
  SHOW_WARNING_DIALOG(payload: {
    title: string;
    message: string;
  }): Promise<Electron.MessageBoxReturnValue>;
  LOG_ERROR(...payload: unknown[]): void;
  LOG_INFO(...payload: unknown[]): void;
};

/*
 * Project Store Types
 */

export type ProjectGetters = {
  PROJECT_NAME: string | undefined;
  IS_EDITED: boolean;
};

export type ProjectMutations = {
  SET_PROJECT_FILEPATH: { filePath?: string };
  SET_SAVED_LAST_COMMAND_UNIX_MILLISEC: number | null;
};

export type ProjectActions = {
  CREATE_NEW_PROJECT(payload: { confirm?: boolean }): void;
  LOAD_PROJECT_FILE(payload: { filePath?: string; confirm?: boolean }): void;
  SAVE_PROJECT_FILE(payload: { overwrite?: boolean }): void;
};

/*
 * Setting Store Types
 */

export type SettingGetters = {
  GET_SAVING_SETTING: SavingSetting;
};

export type SettingMutations = {
  SET_SAVING_SETTING: { savingSetting: SavingSetting };
  SET_HOTKEY_SETTINGS: { hotkeySettings: HotkeySetting[] };
};

export type SettingActions = {
  GET_SAVING_SETTING(): void;
  SET_SAVING_SETTING(payload: { data: SavingSetting }): void;
  GET_HOTKEY_SETTINGS(): void;
  SET_HOTKEY_SETTINGS(payload: {
    data: HotkeySetting;
  }): Promise<HotkeySetting[]>;
};

/*
 * Ui Store Types
 */

export type UiGetters = {
  UI_LOCKED: boolean;
  SHOULD_SHOW_PANES: boolean;
};

export type UiMutations = {
  LOCK_UI: undefined;
  UNLOCK_UI: undefined;
  IS_HELP_DIALOG_OPEN: { isHelpDialogOpen: boolean };
  IS_SETTING_DIALOG_OPEN: { isSettingDialogOpen: boolean };
  SET_USE_GPU: { useGpu: boolean };
  DETECT_UNMAXIMIZED: undefined;
  DETECT_MAXIMIZED: undefined;
  DETECT_PINNED: undefined;
  DETECT_UNPINNED: undefined;
};

export type UiActions = {
  LOCK_UI(): void;
  UNLOCK_UI(): void;
  ASYNC_UI_LOCK(payload: { callback: () => Promise<void> }): void;
  IS_HELP_DIALOG_OPEN(payload: { isHelpDialogOpen: boolean }): void;
  IS_SETTING_DIALOG_OPEN(payload: { isSettingDialogOpen: boolean }): void;
  GET_USE_GPU(): void;
  SET_USE_GPU(payload: { useGpu: boolean }): void;
  DETECT_UNMAXIMIZED(): void;
  DETECT_MAXIMIZED(): void;
  DETECT_PINNED(): void;
  DETECT_UNPINNED(): void;
};

export type AllGetters = AudioGetters &
  AudioCommandGetters &
  CommandGetters &
  IndexGetters &
  ProjectGetters &
  SettingGetters &
  UiGetters;

export type UnionGetters =
  | AudioGetters
  | AudioCommandGetters
  | CommandGetters
  | IndexGetters
  | ProjectGetters
  | SettingGetters
  | UiGetters;

export type AllMutations = AudioMutations &
  AudioCommandMutations &
  CommandMutations &
  IndexMutations &
  ProjectMutations &
  SettingMutations &
  UiMutations;

export type UnionMutations =
  | AudioMutations
  | AudioCommandMutations
  | CommandMutations
  | IndexMutations
  | ProjectMutations
  | SettingMutations
  | UiMutations;

export type AllActions = AudioActions &
  AudioCommandActions &
  CommandActions &
  IndexActions &
  ProjectActions &
  SettingActions &
  UiActions;

export type UnionActions =
  | AudioActions
  | AudioCommandActions
  | CommandActions
  | IndexActions
  | ProjectActions
  | SettingActions
  | UiActions;

export type VoiceVoxStoreOptions<
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase
> = StoreOptions<State, G, A, M, AllGetters, AllActions, AllMutations>;

export const commandMutationsCreator = <M extends MutationsBase>(
  arg: PayloadRecipeTree<State, M>
): MutationTree<State, M> => createCommandMutationTree<State, M>(arg);
