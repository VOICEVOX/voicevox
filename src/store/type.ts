import { Patch } from "immer";
import {
  MutationTree,
  MutationsBase,
  GettersBase,
  ActionsBase,
  StoreOptions,
  PayloadFunction,
} from "./vuex";
import { createCommandMutationTree, PayloadRecipeTree } from "./command";
import {
  AccentPhrase,
  AudioQuery,
  EngineManifest,
  SupportedDevicesInfo,
  UserDictWord,
  MorphableTargetInfo,
  FrameAudioQuery,
} from "@/openapi";
import {
  CharacterInfo,
  DefaultStyleId,
  AcceptRetrieveTelemetryStatus,
  AcceptTermsStatus,
  HotkeySettingType,
  MoraDataType,
  SavingSetting,
  ThemeConf,
  ThemeSetting,
  ExperimentalSettingType,
  ToolbarSettingType,
  UpdateInfo,
  Preset,
  MorphingInfo,
  ActivePointScrollMode,
  EngineInfo,
  ConfirmedTips,
  EngineDirValidationResult,
  EngineSettings,
  MorphableTargetInfoTable,
  EngineSettingType,
  Voice,
  EngineId,
  VoiceId,
  SpeakerId,
  StyleId,
  AudioKey,
  PresetKey,
  RootMiscSettingType,
} from "@/type/preload";
import { IEngineConnectorFactory } from "@/infrastructures/EngineConnector";
import {
  CommonDialogOptions,
  CommonDialogResult,
  NotifyAndNotShowAgainButtonOption,
  LoadingScreenOption,
} from "@/components/Dialog";

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
  presetKey?: PresetKey;
  morphingInfo?: MorphingInfo;
};

export type AudioState = {
  nowGenerating: boolean;
};

export type Command = {
  unixMillisec: number;
  undoPatches: Patch[];
  redoPatches: Patch[];
};

export type EngineState = "STARTING" | "FAILED_STARTING" | "ERROR" | "READY";

// ポートが塞がれていたときの代替ポート情報
export type AltPortInfos = Record<EngineId, { from: number; to: number }>;

export type SaveResult =
  | "SUCCESS"
  | "WRITE_ERROR"
  | "ENGINE_ERROR"
  | "UNKNOWN_ERROR"
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

/*
 * Audio Store Types
 */

export type AudioStoreState = {
  characterInfos: Record<EngineId, CharacterInfo[]>;
  morphableTargetsInfo: Record<EngineId, MorphableTargetInfoTable>;
  audioKeysWithInitializingSpeaker: AudioKey[];
  audioItems: Record<AudioKey, AudioItem>;
  audioKeys: AudioKey[];
  audioStates: Record<AudioKey, AudioState>;
  _activeAudioKey?: AudioKey;
  _selectedAudioKeys?: AudioKey[];
  _audioPlayStartPoint?: number;
  nowPlayingContinuously: boolean;
};

export type AudioStoreTypes = {
  ACTIVE_AUDIO_KEY: {
    getter: AudioKey | undefined;
  };

  SELECTED_AUDIO_KEYS: {
    getter: AudioKey[];
  };

  AUDIO_PLAY_START_POINT: {
    getter: number | undefined;
  };

  LOAD_CHARACTER: {
    action(payload: { engineId: EngineId }): void;
  };

  SET_CHARACTER_INFOS: {
    mutation: { engineId: EngineId; characterInfos: CharacterInfo[] };
  };

  CHARACTER_INFO: {
    getter(engineId: EngineId, styleId: StyleId): CharacterInfo | undefined;
  };

  VOICE_NAME: {
    getter(voice: Voice): string;
  };

  USER_ORDERED_CHARACTER_INFOS: {
    getter(type: "all" | "singerLike" | "talk"): CharacterInfo[] | undefined;
  };

  SETUP_SPEAKER: {
    action(payload: {
      audioKeys: AudioKey[];
      engineId: EngineId;
      styleId: StyleId;
    }): void;
  };

  SET_AUDIO_KEYS_WITH_INITIALIZING_SPEAKER: {
    mutation: { audioKeys: AudioKey[] };
  };

  SET_ACTIVE_AUDIO_KEY: {
    mutation: { audioKey?: AudioKey };
    action(payload: { audioKey?: AudioKey }): void;
  };

  SET_SELECTED_AUDIO_KEYS: {
    mutation: { audioKeys?: AudioKey[] };
    action(payload: { audioKeys?: AudioKey[] }): void;
  };

  SET_AUDIO_PLAY_START_POINT: {
    mutation: { startPoint?: number };
    action(payload: { startPoint?: number }): void;
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
      presetKey?: PresetKey;
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
    action(payload: { engineId: EngineId; baseStyleId: StyleId }): void;
  };

  SET_MORPHABLE_TARGETS: {
    mutation: {
      engineId: EngineId;
      baseStyleId: StyleId;
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
      styleId: StyleId;
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
      styleId: StyleId;
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
      styleId: StyleId;
    }): Promise<AccentPhrase[]>;
  };

  FETCH_AND_COPY_MORA_DATA: {
    action(payload: {
      accentPhrases: AccentPhrase[];
      engineId: EngineId;
      styleId: StyleId;
      copyIndexes: number[];
    }): Promise<AccentPhrase[]>;
  };

  DEFAULT_PROJECT_FILE_BASE_NAME: {
    getter: string;
  };

  DEFAULT_AUDIO_FILE_NAME: {
    getter(audioKey: AudioKey): string;
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
    }): SaveResultObject;
  };

  MULTI_GENERATE_AND_SAVE_AUDIO: {
    action(payload: {
      audioKeys: AudioKey[];
      dirPath?: string;
      callback?: (finishedCount: number) => void;
    }): SaveResultObject[] | undefined;
  };

  GENERATE_AND_CONNECT_AND_SAVE_AUDIO: {
    action(payload: {
      filePath?: string;
      callback?: (finishedCount: number, totalCount: number) => void;
    }): SaveResultObject | undefined;
  };

  CONNECT_AND_EXPORT_TEXT: {
    action(payload: { filePath?: string }): SaveResultObject | undefined;
  };

  PLAY_AUDIO: {
    action(payload: { audioKey: AudioKey }): boolean;
  };

  PLAY_AUDIO_BLOB: {
    action(payload: { audioBlob: Blob; audioKey?: AudioKey }): boolean;
  };

  SET_AUDIO_PRESET_KEY: {
    mutation: {
      audioKey: AudioKey;
      presetKey: PresetKey | undefined;
    };
  };

  PLAY_CONTINUOUSLY_AUDIO: {
    action(): void;
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
    };
    action(payload: {
      audioItem: AudioItem;
      prevAudioKey: AudioKey | undefined;
    }): Promise<AudioKey>;
  };

  COMMAND_MULTI_REMOVE_AUDIO_ITEM: {
    mutation: { audioKeys: AudioKey[] };
    action(payload: { audioKeys: AudioKey[] }): void;
  };

  COMMAND_SET_AUDIO_KEYS: {
    mutation: { audioKeys: AudioKey[] };
    action(payload: { audioKeys: AudioKey[] }): void;
  };

  COMMAND_CHANGE_DISPLAY_TEXT: {
    action(payload: { audioKey: AudioKey; text: string }): void;
  };

  COMMAND_CHANGE_AUDIO_TEXT: {
    mutation: { audioKey: AudioKey; text: string } & (
      | { update: "Text" }
      | { update: "AccentPhrases"; accentPhrases: AccentPhrase[] }
      | { update: "AudioQuery"; query: AudioQuery }
    );
    action(payload: { audioKey: AudioKey; text: string }): void;
  };

  COMMAND_MULTI_CHANGE_VOICE: {
    mutation: {
      voice: Voice;
      changes: Record<
        AudioKey,
        | {
            update: "AccentPhrases";
            accentPhrases: AccentPhrase[];
          }
        | {
            update: "AudioQuery";
            query: AudioQuery;
          }
        | {
            update: "OnlyVoice";
          }
      >;
    };
    action(payload: { audioKeys: AudioKey[]; voice: Voice }): void;
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

  COMMAND_DELETE_ACCENT_PHRASE: {
    action(payload: { audioKey: AudioKey; accentPhraseIndex: number }): void;
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

  COMMAND_MULTI_RESET_MORA_PITCH_AND_LENGTH: {
    action(payload: { audioKeys: AudioKey[] }): void;
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

  COMMAND_MULTI_SET_AUDIO_SPEED_SCALE: {
    mutation: { audioKeys: AudioKey[]; speedScale: number };
    action(payload: { audioKeys: AudioKey[]; speedScale: number }): void;
  };

  COMMAND_MULTI_SET_AUDIO_PITCH_SCALE: {
    mutation: { audioKeys: AudioKey[]; pitchScale: number };
    action(payload: { audioKeys: AudioKey[]; pitchScale: number }): void;
  };

  COMMAND_MULTI_SET_AUDIO_INTONATION_SCALE: {
    mutation: { audioKeys: AudioKey[]; intonationScale: number };
    action(payload: { audioKeys: AudioKey[]; intonationScale: number }): void;
  };

  COMMAND_MULTI_SET_AUDIO_VOLUME_SCALE: {
    mutation: { audioKeys: AudioKey[]; volumeScale: number };
    action(payload: { audioKeys: AudioKey[]; volumeScale: number }): void;
  };

  COMMAND_MULTI_SET_AUDIO_PRE_PHONEME_LENGTH: {
    mutation: { audioKeys: AudioKey[]; prePhonemeLength: number };
    action(payload: { audioKeys: AudioKey[]; prePhonemeLength: number }): void;
  };

  COMMAND_MULTI_SET_AUDIO_POST_PHONEME_LENGTH: {
    mutation: { audioKeys: AudioKey[]; postPhonemeLength: number };
    action(payload: { audioKeys: AudioKey[]; postPhonemeLength: number }): void;
  };

  COMMAND_MULTI_SET_MORPHING_INFO: {
    mutation: {
      audioKeys: AudioKey[];
      morphingInfo: MorphingInfo | undefined;
    };
    action(payload: {
      audioKeys: AudioKey[];
      morphingInfo: MorphingInfo | undefined;
    }): void;
  };

  COMMAND_MULTI_SET_AUDIO_PRESET: {
    mutation: {
      audioKeys: AudioKey[];
      presetKey: PresetKey | undefined;
    };
    action(payload: {
      audioKeys: AudioKey[];
      presetKey: PresetKey | undefined;
    }): void;
  };

  COMMAND_MULTI_APPLY_AUDIO_PRESET: {
    mutation: { audioKeys: AudioKey[] };
    action(payload: { audioKeys: AudioKey[] }): void;
  };

  COMMAND_FULLY_APPLY_AUDIO_PRESET: {
    mutation: { presetKey: PresetKey };
    action(payload: { presetKey: PresetKey }): void;
  };

  COMMAND_IMPORT_FROM_FILE: {
    mutation: {
      audioKeyItemPairs: { audioItem: AudioItem; audioKey: AudioKey }[];
    };
    action(payload: { filePath?: string }): void;
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
 * Audio Player Store Types
 */

export type AudioPlayerStoreState = {
  nowPlayingAudioKey?: AudioKey;
};

export type AudioPlayerStoreTypes = {
  ACTIVE_AUDIO_ELEM_CURRENT_TIME: {
    getter: number | undefined;
  };

  NOW_PLAYING: {
    getter: boolean;
  };

  SET_AUDIO_NOW_PLAYING: {
    mutation: { audioKey: AudioKey; nowPlaying: boolean };
  };

  SET_AUDIO_SOURCE: {
    mutation: { audioBlob: Blob };
  };

  PLAY_AUDIO_PLAYER: {
    action(payload: { offset?: number; audioKey?: AudioKey }): Promise<boolean>;
  };

  STOP_AUDIO: {
    action(): void;
  };
};

/*
 * Singing Store Types
 */

export type Tempo = {
  position: number;
  bpm: number;
};

export type TimeSignature = {
  measureNumber: number;
  beats: number;
  beatType: number;
};

export type Note = {
  id: string;
  position: number;
  duration: number;
  noteNumber: number;
  lyric: string;
};

export type Score = {
  tpqn: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
  notes: Note[];
};

export type Singer = {
  engineId: EngineId;
  styleId: StyleId;
};

export type PhraseState =
  | "WAITING_TO_BE_RENDERED"
  | "NOW_RENDERING"
  | "COULD_NOT_RENDER"
  | "PLAYABLE";

export type Phrase = {
  singer?: Singer;
  score: Score;
  startTicks: number;
  endTicks: number;
  state: PhraseState;
  query?: FrameAudioQuery;
  startTime?: number;
};

export type SingingStoreState = {
  singer?: Singer;
  score: Score;
  phrases: Map<string, Phrase>;
  // NOTE: UIの状態などは分割・統合した方がよさそうだが、ボイス側と混在させないためいったん局所化する
  isShowSinger: boolean;
  sequencerZoomX: number;
  sequencerZoomY: number;
  sequencerSnapType: number;
  selectedNoteIds: Set<string>;
  overlappingNoteIds: Set<string>;
  editingLyricNoteId?: string;
  nowPlaying: boolean;
  volume: number;
  leftLocatorPosition: number;
  rightLocatorPosition: number;
  startRenderingRequested: boolean;
  stopRenderingRequested: boolean;
  nowRendering: boolean;
  nowAudioExporting: boolean;
  cancellationOfAudioExportRequested: boolean;
};

export type SingingStoreTypes = {
  SET_SHOW_SINGER: {
    mutation: { isShowSinger: boolean };
    action(payload: { isShowSinger: boolean }): void;
  };

  SET_SINGER: {
    mutation: { singer?: Singer };
    action(payload: { singer?: Singer }): void;
  };

  SET_SCORE: {
    mutation: { score: Score };
    action(payload: { score: Score }): void;
  };

  SET_TEMPO: {
    mutation: { tempo: Tempo };
    action(payload: { tempo: Tempo }): void;
  };

  REMOVE_TEMPO: {
    mutation: { position: number };
    action(payload: { position: number }): void;
  };

  SET_TIME_SIGNATURE: {
    mutation: { timeSignature: TimeSignature };
    action(payload: { timeSignature: TimeSignature }): void;
  };

  REMOVE_TIME_SIGNATURE: {
    mutation: { measureNumber: number };
    action(payload: { measureNumber: number }): void;
  };

  NOTE_IDS: {
    getter: Set<string>;
  };

  ADD_NOTES: {
    mutation: { notes: Note[] };
    action(payload: { notes: Note[] }): void;
  };

  UPDATE_NOTES: {
    mutation: { notes: Note[] };
    action(payload: { notes: Note[] }): void;
  };

  REMOVE_NOTES: {
    mutation: { noteIds: string[] };
    action(payload: { noteIds: string[] }): void;
  };

  SELECT_NOTES: {
    mutation: { noteIds: string[] };
    action(payload: { noteIds: string[] }): void;
  };

  DESELECT_ALL_NOTES: {
    mutation: undefined;
    action(): void;
  };

  REMOVE_SELECTED_NOTES: {
    action(): void;
  };

  SET_EDITING_LYRIC_NOTE_ID: {
    mutation: { noteId?: string };
    action(payload: { noteId?: string }): void;
  };

  SET_PHRASE: {
    mutation: { phraseKey: string; phrase: Phrase };
  };

  DELETE_PHRASE: {
    mutation: { phraseKey: string };
  };

  SET_STATE_TO_PHRASE: {
    mutation: { phraseKey: string; phraseState: PhraseState };
  };

  SET_FRAME_AUDIO_QUERY_TO_PHRASE: {
    mutation: { phraseKey: string; frameAudioQuery: FrameAudioQuery };
  };

  SET_START_TIME_TO_PHRASE: {
    mutation: { phraseKey: string; startTime: number };
  };

  SET_SNAP_TYPE: {
    mutation: { snapType: number };
    action(payload: { snapType: number }): void;
  };

  SET_ZOOM_X: {
    mutation: { zoomX: number };
    action(payload: { zoomX: number }): void;
  };

  SET_ZOOM_Y: {
    mutation: { zoomY: number };
    action(payload: { zoomY: number }): void;
  };

  SET_IS_DRAG: {
    mutation: { isDrag: boolean };
    action(payload: { isDrag: boolean }): void;
  };

  IMPORT_MIDI_FILE: {
    action(payload: { filePath?: string }): void;
  };

  IMPORT_MUSICXML_FILE: {
    action(payload: { filePath?: string }): void;
  };

  EXPORT_WAVE_FILE: {
    action(payload: { filePath?: string }): SaveResultObject;
  };

  CANCEL_AUDIO_EXPORT: {
    action(): void;
  };

  TICK_TO_SECOND: {
    getter(position: number): number;
  };

  SECOND_TO_TICK: {
    getter(time: number): number;
  };

  GET_PLAYHEAD_POSITION: {
    getter(): number;
  };

  SET_PLAYHEAD_POSITION: {
    action(payload: { position: number }): void;
  };

  ADD_PLAYHEAD_POSITION_CHANGE_LISTENER: {
    action(payload: { listener: (position: number) => void }): void;
  };

  REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER: {
    action(payload: { listener: (position: number) => void }): void;
  };

  SET_LEFT_LOCATOR_POSITION: {
    mutation: { position: number };
    action(payload: { position: number }): void;
  };

  SET_RIGHT_LOCATOR_POSITION: {
    mutation: { position: number };
    action(payload: { position: number }): void;
  };

  SET_PLAYBACK_STATE: {
    mutation: { nowPlaying: boolean };
  };

  SING_PLAY_AUDIO: {
    action(): void;
  };

  SING_STOP_AUDIO: {
    action(): void;
  };

  SET_VOLUME: {
    mutation: { volume: number };
    action(payload: { volume: number }): void;
  };

  PLAY_PREVIEW_SOUND: {
    action(payload: { noteNumber: number; duration?: number }): void;
  };

  STOP_PREVIEW_SOUND: {
    action(payload: { noteNumber: number }): void;
  };

  SET_START_RENDERING_REQUESTED: {
    mutation: { startRenderingRequested: boolean };
  };

  SET_STOP_RENDERING_REQUESTED: {
    mutation: { stopRenderingRequested: boolean };
  };

  SET_NOW_RENDERING: {
    mutation: { nowRendering: boolean };
  };

  SET_NOW_AUDIO_EXPORTING: {
    mutation: { nowAudioExporting: boolean };
  };

  SET_CANCELLATION_OF_AUDIO_EXPORT_REQUESTED: {
    mutation: { cancellationOfAudioExportRequested: boolean };
  };

  RENDER: {
    action(): void;
  };

  STOP_RENDERING: {
    action(): void;
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
  engineStates: Record<EngineId, EngineState>;
  engineSupportedDevices: Record<EngineId, SupportedDevicesInfo>;
  altPortInfos: AltPortInfos;
};

export type EngineStoreTypes = {
  GET_ENGINE_INFOS: {
    action(): void;
  };

  SET_ENGINE_INFO: {
    mutation: { engineId: EngineId; engineInfo: EngineInfo };
  };

  GET_ONLY_ENGINE_INFOS: {
    action: (payload: { engineIds: EngineId[] }) => Promise<void>;
  };

  GET_SORTED_ENGINE_INFOS: {
    getter: EngineInfo[];
  };

  GET_ALT_PORT_INFOS: {
    action(): Promise<AltPortInfos>;
  };

  SET_ALT_PORT_INFOS: {
    mutation: { altPortInfos: AltPortInfos };
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
    action(payload: { engineId: EngineId; styleId: StyleId }): Promise<boolean>;
  };

  INITIALIZE_ENGINE_SPEAKER: {
    action(payload: { engineId: EngineId; styleId: StyleId }): void;
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

  GET_ALL_VOICES: {
    getter: Voice[];
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
    action(payload: { overwrite?: boolean }): boolean;
  };

  SAVE_OR_DISCARD_PROJECT_FILE: {
    action(palyoad: {
      additionalMessage?: string;
    }): "saved" | "discarded" | "canceled";
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
  hotkeySettings: HotkeySettingType[];
  toolbarSetting: ToolbarSettingType;
  engineIds: EngineId[];
  engineInfos: Record<EngineId, EngineInfo>;
  engineManifests: Record<EngineId, EngineManifest>;
  themeSetting: ThemeSetting;
  acceptTerms: AcceptTermsStatus;
  acceptRetrieveTelemetry: AcceptRetrieveTelemetryStatus;
  experimentalSetting: ExperimentalSettingType;
  confirmedTips: ConfirmedTips;
  engineSettings: EngineSettings;
} & RootMiscSettingType;

// keyとvalueの型を連動するようにしたPayloadを作る
type KeyValuePayload<R, K extends keyof R = keyof R> = K extends keyof R
  ? {
      key: K;
      value: R[K];
    }
  : never;

export type SettingStoreTypes = {
  HYDRATE_SETTING_STORE: {
    action(): void;
  };

  SET_SAVING_SETTING: {
    mutation: { savingSetting: SavingSetting };
    action(payload: { data: SavingSetting }): void;
  };

  SET_HOTKEY_SETTINGS: {
    mutation: { newHotkey: HotkeySettingType };
    action(payload: { data: HotkeySettingType }): void;
  };

  SET_TOOLBAR_SETTING: {
    mutation: { toolbarSetting: ToolbarSettingType };
    action(payload: { data: ToolbarSettingType }): void;
  };

  SET_ROOT_MISC_SETTING: {
    mutation: KeyValuePayload<RootMiscSettingType>;
    action(payload: KeyValuePayload<RootMiscSettingType>): void;
  };

  SET_THEME_SETTING: {
    mutation: { currentTheme: string; themes?: ThemeConf[] };
    action(payload: { currentTheme: string }): void;
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
    mutation: { experimentalSetting: ExperimentalSettingType };
    action(payload: { experimentalSetting: ExperimentalSettingType }): void;
  };

  SET_CONFIRMED_TIPS: {
    mutation: { confirmedTips: ConfirmedTips };
    action(payload: { confirmedTips: ConfirmedTips }): void;
  };

  SET_CONFIRMED_TIP: {
    action(payload: { confirmedTip: Partial<ConfirmedTips> }): void;
  };

  RESET_CONFIRMED_TIPS: {
    action(): void;
  };

  SET_ENGINE_SETTING: {
    mutation: { engineSetting: EngineSettingType; engineId: EngineId };
    action(payload: {
      engineSetting: EngineSettingType;
      engineId: EngineId;
    }): Promise<void>;
  };

  CHANGE_USE_GPU: {
    action(payload: { useGpu: boolean; engineId: EngineId }): Promise<void>;
  };

  GET_RECENTLY_USED_PROJECTS: {
    action(): Promise<string[]>;
  };

  APPEND_RECENTLY_USED_PROJECT: {
    action(payload: { filePath: string }): Promise<void>;
  };
};

/*
 * Ui Store Types
 */

export type UiStoreState = {
  uiLockCount: number;
  dialogLockCount: number;
  reloadingLock: boolean;
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
  isUpdateNotificationDialogOpen: boolean;
  isMaximized: boolean;
  isPinned: boolean;
  isFullscreen: boolean;
  progress: number;
  isVuexReady: boolean;
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

  LOCK_RELOADING: {
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
      isUpdateNotificationDialogOpen?: boolean;
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
      isUpdateNotificationDialogOpen?: boolean;
    }): void;
  };

  SHOW_ALERT_DIALOG: {
    action(payload: CommonDialogOptions["alert"]): CommonDialogResult;
  };

  SHOW_CONFIRM_DIALOG: {
    action(payload: CommonDialogOptions["confirm"]): CommonDialogResult;
  };

  SHOW_WARNING_DIALOG: {
    action(payload: CommonDialogOptions["warning"]): CommonDialogResult;
  };

  SHOW_NOTIFY_AND_NOT_SHOW_AGAIN_BUTTON: {
    action(payload: NotifyAndNotShowAgainButtonOption): void;
  };

  SHOW_LOADING_SCREEN: {
    action(payload: LoadingScreenOption): void;
  };

  HIDE_ALL_LOADING_SCREEN: {
    action(): void;
  };

  ON_VUEX_READY: {
    mutation: void;
    action(): void;
  };

  WAIT_VUEX_READY: {
    action(palyoad: { timeout: number }): Promise<void>;
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
    action(
      obj:
        | { closeOrReload: "close" }
        | {
            closeOrReload: "reload";
            isMultiEngineOffMode?: boolean;
          }
    ): Promise<void>;
  };

  RELOAD_APP: {
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
  presetKeys: PresetKey[];
  presetItems: Record<PresetKey, Preset>;
  defaultPresetKeys: Record<VoiceId, PresetKey>;
};

export type PresetStoreTypes = {
  DEFAULT_PRESET_KEY_SETS: {
    getter: Set<PresetKey>;
  };
  SET_PRESET_ITEMS: {
    mutation: {
      presetItems: Record<PresetKey, Preset>;
    };
  };
  SET_PRESET_KEYS: {
    mutation: {
      presetKeys: PresetKey[];
    };
  };
  SET_DEFAULT_PRESET_MAP: {
    action(payload: { defaultPresetKeys: Record<VoiceId, PresetKey> }): void;
    mutation: {
      defaultPresetKeys: Record<VoiceId, PresetKey>;
    };
  };
  HYDRATE_PRESET_STORE: {
    action(): void;
  };
  SAVE_PRESET_ORDER: {
    action(payload: { presetKeys: PresetKey[] }): void;
  };
  SAVE_PRESET_CONFIG: {
    action(payload: {
      presetItems: Record<string, Preset>;
      presetKeys: PresetKey[];
    }): void;
  };
  ADD_PRESET: {
    action(payload: { presetData: Preset }): Promise<PresetKey>;
  };
  CREATE_ALL_DEFAULT_PRESET: {
    action(): void;
  };
  UPDATE_PRESET: {
    action(payload: { presetData: Preset; presetKey: PresetKey }): void;
  };
  DELETE_PRESET: {
    action(payload: { presetKey: PresetKey }): void;
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
  AudioPlayerStoreState &
  AudioCommandStoreState &
  SingingStoreState &
  CommandStoreState &
  EngineStoreState &
  IndexStoreState &
  ProjectStoreState &
  SettingStoreState &
  UiStoreState &
  PresetStoreState &
  DictionaryStoreState &
  ProxyStoreState &
  SingingStoreState;

type AllStoreTypes = AudioStoreTypes &
  AudioPlayerStoreTypes &
  AudioCommandStoreTypes &
  CommandStoreTypes &
  EngineStoreTypes &
  IndexStoreTypes &
  ProjectStoreTypes &
  SettingStoreTypes &
  UiStoreTypes &
  PresetStoreTypes &
  DictionaryStoreTypes &
  ProxyStoreTypes &
  SingingStoreTypes;

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
