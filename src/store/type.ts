import { StoreOptions, ActionTree, MutationTree } from "vuex";
import { Operation } from "rfc6902";
import { AccentPhrase, AudioQuery } from "@/openapi";
import {
  createCommandMutationTree,
  PayloadRecipeTree,
  PayloadMutationTree,
  CommandGetters,
  CommandMutations,
  CommandActions,
} from "./command";
import {
  CharacterInfo,
  Encoding as EncodingType,
  SavingSetting,
} from "@/type/preload";
import {
  SettingActions,
  SettingGetters,
  SettingMutations,
} from "@/store/setting";
import { UiActions, UiGetters, UiMutations } from "@/store/ui";
import {
  ProjectActions,
  ProjectGetters,
  ProjectMutations,
} from "@/store/project";
import { IndexActions, IndexGetters, IndexMutations } from "@/store/index";

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
  SET_ACCENT_PHRASES: { audioKey: string; accentPhrases: AccentPhrase[] };
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
  SET_AUDIO_CHARACTER_INDEX(payload: {
    audioKey: string;
    characterIndex: number;
  }): void;
  CHANGE_CHARACTER_INDEX(payload: {
    audioKey: string;
    characterIndex: number;
  }): void;
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
  SET_SINGLE_ACCENT_PHRASE(payload: {
    audioKey: string;
    accentPhraseIndex: number;
    accentPhrases: AccentPhrase[];
    popUntilPause: boolean;
  }): void;
  SET_AUDIO_QUERY(payload: { audioKey: string; audioQuery: AudioQuery }): void;
  FETCH_ACCENT_PHRASES(payload: {
    text: string;
    characterIndex: number;
    isKana: boolean | undefined;
  }): AccentPhrase[];
  FETCH_AND_SET_ACCENT_PHRASES(payload: { audioKey: string }): void;
  FETCH_AND_SET_SINGLE_ACCENT_PHRASE(payload: {
    audioKey: string;
    newPronunciation: string;
    accentPhraseIndex: number;
    popUntilPause: boolean;
  }): void;
  FETCH_MORA_DATA(payload: {
    accentPhrases: AccentPhrase[];
    characterIndex: number;
  }): AccentPhrase[];
  FETCH_AND_SET_MORA_DATA(payload: {
    audioKey: string;
    changeIndexes?: number[];
  }): void;
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
  COMMAND_CHANGE_ACCENT: {
    audioKey: string;
    accentPhrases: AccentPhrase[];
  };
  COMMAND_CHANGE_ACCENT_PHRASE_SPLIT: {
    audioKey: string;
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

export type AllGetters = AudioGetters &
  AudioCommandActions &
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
