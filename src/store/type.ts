import { StoreOptions, ActionTree, MutationTree } from "vuex";
import { Operation } from "rfc6902";
import { AccentPhrase, AudioQuery } from "@/openapi";
import {
  createCommandMutationTree,
  PayloadRecipeTree,
  PayloadMutationTree,
  OldCommand,
} from "./command";
import {
  CharacterInfo,
  Encoding as EncodingType,
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
  useGpu: boolean;
  isHelpDialogOpen: boolean;
  isSettingDialogOpen: boolean;
  isMaximized: boolean;
  projectFilePath?: string;
  savingSetting: SavingSetting;
  isPinned: boolean;
};

export type AudioItem = {
  text: string;
  characterIndex?: number;
  query?: AudioQuery;
};

export type AudioState = {
  nowPlaying: boolean;
  nowGenerating: boolean;
};

export type Command = {
  undoOperations: Operation[];
  redoOperations: Operation[];
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
  REMOVE_AUDIO_ITEM: { audioKey: string };
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
  SET_AUDIO_CHARACTER_INDEX: { audioKey: string; characterIndex: number };
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
    pitch: number;
  };
};

export type AudioActions = {
  START_WAITING_ENGINE(): void;
  LOAD_CHARACTER(): void;
  SET_AUDIO_TEXT(payload: { audioKey: string; text: string }): void;
  REMOVE_ALL_AUDIO_ITEM(): void;
  REGISTER_AUDIO_ITEM(payload: {
    audioItem: AudioItem;
    prevAudioKey: string | undefined;
  }): string;
  SET_ACTIVE_AUDIO_KEY(payload: { audioKey?: string }): void;
  GET_AUDIO_CACHE(payload: { audioKey: string }): Blob | null;
  SET_ACCENT_PHRASES(payload: {
    audioKey: string;
    accentPhrases: AccentPhrase[];
  }): void;
  SET_AUDIO_QUERY(payload: { audioKey: string; audioQuery: AudioQuery }): void;
  FETCH_ACCENT_PHRASES(payload: {
    text: string;
    characterIndex: number;
    isKana: boolean | undefined;
  }): AccentPhrase[];
  FETCH_AND_SET_ACCENT_PHRASES(payload: { audioKey: string }): void;
  FETCH_MORA_DATA(payload: {
    accentPhrases: AccentPhrase[];
    characterIndex: number;
  }): AccentPhrase[];
  FETCH_AND_COPY_MORA_DATA(payload: {
    accentPhrases: AccentPhrase[];
    characterIndex: number;
    copyIndexes: number[];
  }): AccentPhrase[];
  FETCH_AUDIO_QUERY(payload: {
    text: string;
    characterIndex: number;
  }): AudioQuery;
  FETCH_AND_SET_AUDIO_QUERY(payload: { audioKey: string }): void;
  GENERATE_AUDIO(payload: { audioKey: string }): Blob | null;
  GENERATE_AND_SAVE_AUDIO(payload: {
    audioKey: string;
    filePath?: string;
    encoding?: EncodingType;
  }): SaveResultObject;
  GENERATE_AND_SAVE_ALL_AUDIO(payload: {
    dirPath?: string;
    encoding: EncodingType;
  }): SaveResultObject[];
  IMPORT_FROM_FILE(payload: { filePath?: string }): string[] | void;
  PLAY_AUDIO(payload: { audioKey: string }): boolean;
  STOP_AUDIO(payload: { audioKey: string }): void;
  PLAY_CONTINUOUSLY_AUDIO(): void;
  STOP_CONTINUOUSLY_AUDIO(): void;
  PUT_TEXTS(payload: {
    texts: string[];
    characterIndex: number | undefined;
    prevAudioKey: string | undefined;
  }): void[];
  OPEN_TEXT_EDIT_CONTEXT_MENU(): void;
  DETECTED_ENGINE_ERROR(): void;
  RESTART_ENGINE(): void;
  CHECK_FILE_EXISTS(payload: { file: string }): boolean;
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
  }): string;
  COMMAND_REMOVE_AUDIO_ITEM(payload: { audioKey: string }): void;
  COMMAND_CHANGE_CHARACTER_INDEX(payload: {
    audioKey: string;
    characterIndex: number;
  }): void;
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
  COMMAND_CHANGE_ACCENT_PHRASE_SPLIT(payload: {
    audioKey: string;
    newPronunciation: string;
    accentPhraseIndex: number;
    popUntilPause: boolean;
  }): void;
  COMMAND_SET_AUDIO_MORA_DATA(payload: {
    audioKey: string;
    accentPhraseIndex: number;
    moraIndex: number;
    pitch: number;
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
};

export type AudioCommandMutations = {
  COMMAND_REGISTER_AUDIO_ITEM: {
    audioItem: AudioItem;
    audioKey: string;
    prevAudioKey: string | undefined;
  };
  COMMAND_REMOVE_AUDIO_ITEM: { audioKey: string };
  COMMAND_CHANGE_CHARACTER_INDEX: {
    characterIndex: number;
    audioKey: string;
  } & (
    | {
        update: "CharacterIndex";
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
    accentPhraseIndex: number;
    accentPhrases: AccentPhrase[];
  };
  COMMAND_SET_AUDIO_MORA_DATA: {
    audioKey: string;
    accentPhraseIndex: number;
    moraIndex: number;
    pitch: number;
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
};

/*
 * Command Store Types
 */

export type CommandGetters = {
  CAN_UNDO: boolean;
  CAN_REDO: boolean;
};

export type CommandMutations = {
  OLD_PUSH_COMMAND: { command: OldCommand<State> };
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
  GET_POLICY_TEXT(): string;
  GET_OSS_LICENSES(): Record<string, string>[];
  GET_UPDATE_INFOS(): UpdateInfo[];
  SHOW_WARNING_DIALOG(payload: {
    title: string;
    message: string;
  }): Electron.MessageBoxReturnValue;
  LOG_ERROR(payload: unknown[]): void;
};

/*
 * Project Store Types
 */

export type ProjectGetters = {
  PROJECT_NAME: string | undefined;
};

export type ProjectMutations = {
  SET_PROJECT_FILEPATH: { filePath: string };
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
  GET_SAVING_SETTING_DATA: SavingSetting;
};

export type SettingMutations = {
  SET_SAVING_SETTING_DATA: { savingSetting: SavingSetting };
};

export type SettingActions = {
  GET_SAVING_SETTING_DATA(): void;
  SET_SAVING_SETTING_DATA(): void;
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

export type AllMutations = AudioMutations &
  AudioCommandMutations &
  CommandMutations &
  IndexMutations &
  ProjectMutations &
  SettingMutations &
  UiMutations;

export type AllActions = AudioActions &
  AudioCommandActions &
  CommandActions &
  IndexActions &
  ProjectActions &
  SettingActions &
  UiActions;

export const typeAsStoreOptions = <Arg extends StoreOptions<State>>(
  arg: Arg
): Arg => arg;
export const typeAsMutationTree = <Arg extends MutationTree<State>>(
  arg: Arg
): Arg => arg;
export const typeAsActionTree = <Arg extends ActionTree<State, State>>(
  arg: Arg
): Arg => arg;

export const commandMutationsCreator = <Arg extends PayloadRecipeTree<State>>(
  arg: Arg
): PayloadMutationTree<State> => createCommandMutationTree<State, Arg>(arg);
