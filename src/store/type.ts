import { Patch } from "immer";
import { z } from "zod";
import { Project as UfProject } from "@sevenc-nanashi/utaformatix-ts";
import {
  MutationTree,
  MutationsBase,
  GettersBase,
  ActionsBase,
  StoreOptions,
  PayloadFunction,
  Store,
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
  Note as NoteForRequestToEngine,
} from "@/openapi";
import {
  CharacterInfo,
  DefaultStyleId,
  AcceptRetrieveTelemetryStatus,
  AcceptTermsStatus,
  MoraDataType,
  SavingSetting,
  ThemeConf,
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
  EditorType,
  NoteId,
  CommandId,
  TrackId,
} from "@/type/preload";
import { IEngineConnectorFactory } from "@/infrastructures/EngineConnector";
import {
  TextDialogResult,
  NotifyAndNotShowAgainButtonOption,
  MessageDialogOptions,
  ConfirmDialogOptions,
  WarningDialogOptions,
} from "@/components/Dialog/Dialog";
import {
  LatestProjectType,
  noteSchema,
  singerSchema,
  tempoSchema,
  timeSignatureSchema,
  trackSchema,
} from "@/domain/project/schema";
import { HotkeySettingType } from "@/domain/hotkeyAction";
import {
  MultiFileProjectFormat,
  SingleFileProjectFormat,
} from "@/sing/utaformatixProject/utils";

/**
 * エディタ用のAudioQuery
 */
export type EditorAudioQuery = Omit<
  AudioQuery,
  "outputSamplingRate" | "pauseLengthScale"
> & {
  outputSamplingRate: number | "engineDefault";
  pauseLengthScale: number; // エンジンと違って必須
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

export type FetchAudioResult = {
  audioQuery: EditorAudioQuery;
  blob: Blob;
};

export type Command = {
  id: CommandId;
  undoPatches: Patch[];
  redoPatches: Patch[];
};

export type EngineState = "STARTING" | "FAILED_STARTING" | "ERROR" | "READY";

// ポートが塞がれていたときの代替ポート情報
export type AltPortInfos = Record<EngineId, string>;

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

export type WatchStoreStatePlugin = (
  store: Store<State, AllGetters, AllActions, AllMutations>,
) => void;

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

  SET_AUDIO_PAUSE_LENGTH_SCALE: {
    mutation: { audioKey: AudioKey; pauseLengthScale: number };
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
        Record<number, MorphableTargetInfo>,
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
    mutation: { audioKey: AudioKey; audioQuery: EditorAudioQuery };
    action(payload: { audioKey: AudioKey; audioQuery: EditorAudioQuery }): void;
  };

  FETCH_AUDIO_QUERY: {
    action(payload: {
      text: string;
      engineId: EngineId;
      styleId: StyleId;
    }): Promise<EditorAudioQuery>;
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

  GET_AUDIO_PLAY_OFFSETS: {
    action(payload: { audioKey: AudioKey }): number[];
  };

  FETCH_AUDIO: {
    action(payload: { audioKey: AudioKey }): Promise<FetchAudioResult>;
  };

  FETCH_AUDIO_FROM_AUDIO_ITEM: {
    action(payload: { audioItem: AudioItem }): Promise<FetchAudioResult>;
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
      | { update: "AudioQuery"; query: EditorAudioQuery }
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
            query: EditorAudioQuery;
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
      ),
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

  COMMAND_MULTI_SET_AUDIO_PAUSE_LENGTH_SCALE: {
    mutation: { audioKeys: AudioKey[]; pauseLengthScale: number };
    action(payload: { audioKeys: AudioKey[]; pauseLengthScale: number }): void;
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
    action(
      payload:
        | { type: "dialog" }
        | { type: "path"; filePath: string }
        | { type: "file"; file: File },
    ): void;
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

// schemaはプロジェクトファイル用
export type Tempo = z.infer<typeof tempoSchema>;

export type TimeSignature = z.infer<typeof timeSignatureSchema>;

export type Note = z.infer<typeof noteSchema>;

export type Singer = z.infer<typeof singerSchema>;

export type Track = z.infer<typeof trackSchema>;

export type PhraseState =
  | "SINGER_IS_NOT_SET"
  | "WAITING_TO_BE_RENDERED"
  | "NOW_RENDERING"
  | "COULD_NOT_RENDER"
  | "PLAYABLE";

/**
 * エディタ用のFrameAudioQuery
 */
export type EditorFrameAudioQuery = FrameAudioQuery & { frameRate: number };

/**
 * 歌唱ピッチ
 */
export type SingingPitch = number[];

/**
 * 歌唱ボリューム
 */
export type SingingVolume = number[];

/**
 * 歌声
 */
export type SingingVoice = Blob;

const editorFrameAudioQueryKeySchema = z
  .string()
  .brand<"EditorFrameAudioQueryKey">();
export type EditorFrameAudioQueryKey = z.infer<
  typeof editorFrameAudioQueryKeySchema
>;
export const EditorFrameAudioQueryKey = (
  id: string,
): EditorFrameAudioQueryKey => editorFrameAudioQueryKeySchema.parse(id);

const singingPitchKeySchema = z.string().brand<"SingingPitchKey">();
export type SingingPitchKey = z.infer<typeof singingPitchKeySchema>;
export const SingingPitchKey = (id: string): SingingPitchKey =>
  singingPitchKeySchema.parse(id);

const singingVolumeKeySchema = z.string().brand<"SingingVolumeKey">();
export type SingingVolumeKey = z.infer<typeof singingVolumeKeySchema>;
export const SingingVolumeKey = (id: string): SingingVolumeKey =>
  singingVolumeKeySchema.parse(id);

const singingVoiceKeySchema = z.string().brand<"SingingVoiceKey">();
export type SingingVoiceKey = z.infer<typeof singingVoiceKeySchema>;
export const SingingVoiceKey = (id: string): SingingVoiceKey =>
  singingVoiceKeySchema.parse(id);

const sequenceIdSchema = z.string().brand<"SequenceId">();
export type SequenceId = z.infer<typeof sequenceIdSchema>;
export const SequenceId = (id: string): SequenceId =>
  sequenceIdSchema.parse(id);

/**
 * フレーズ（レンダリング区間）
 */
export type Phrase = {
  firstRestDuration: number;
  notes: Note[];
  startTime: number;
  state: PhraseState;
  queryKey?: EditorFrameAudioQueryKey;
  singingPitchKey?: SingingPitchKey;
  singingVolumeKey?: SingingVolumeKey;
  singingVoiceKey?: SingingVoiceKey;
  sequenceId?: SequenceId;
  trackId: TrackId; // NOTE: state.tracksと同期していないので使用する際は注意
};

/**
 * フレーズの生成に必要なデータ
 */
export type PhraseSource = {
  firstRestDuration: number;
  notes: Note[];
  startTime: number;
  trackId: TrackId;
};

const phraseKeySchema = z.string().brand<"PhraseKey">();
export type PhraseKey = z.infer<typeof phraseKeySchema>;
export const PhraseKey = (id: string): PhraseKey => phraseKeySchema.parse(id);

// 編集対象 ノート or ピッチ
// ボリュームを足すのであれば"VOLUME"を追加する
export type SequencerEditTarget = "NOTE" | "PITCH";

// ノート編集ツール
export type NoteEditTool = "SELECT_FIRST" | "EDIT_FIRST";
// ピッチ編集ツール
export type PitchEditTool = "DRAW" | "ERASE";

// プロジェクトの書き出しに使えるファイル形式
export type ExportSongProjectFileType =
  | SingleFileProjectFormat
  | MultiFileProjectFormat;

export type TrackParameters = {
  gain: boolean;
  pan: boolean;
  soloAndMute: boolean;
};

export type SongExportSetting = {
  isMono: boolean;
  sampleRate: number;
  withLimiter: boolean;
  withTrackParameters: TrackParameters;
};

export type SongExportState =
  | "EXPORTING_AUDIO"
  | "EXPORTING_LABEL"
  | "NOT_EXPORTING";

export type SingingStoreState = {
  tpqn: number; // Ticks Per Quarter Note
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
  tracks: Map<TrackId, Track>;
  trackOrder: TrackId[];
  _selectedTrackId: TrackId;
  editorFrameRate: number;
  phrases: Map<PhraseKey, Phrase>;
  phraseQueries: Map<EditorFrameAudioQueryKey, EditorFrameAudioQuery>;
  phraseSingingPitches: Map<SingingPitchKey, SingingPitch>;
  phraseSingingVolumes: Map<SingingVolumeKey, SingingVolume>;
  sequencerZoomX: number;
  sequencerZoomY: number;
  sequencerSnapType: number;
  sequencerEditTarget: SequencerEditTarget;
  sequencerNoteTool: NoteEditTool;
  sequencerPitchTool: PitchEditTool;
  _selectedNoteIds: Set<NoteId>;
  editingLyricNoteId?: NoteId;
  nowPlaying: boolean;
  volume: number;
  startRenderingRequested: boolean;
  stopRenderingRequested: boolean;
  nowRendering: boolean;
  exportState: SongExportState;
  cancellationOfExportRequested: boolean;
  isSongSidebarOpen: boolean;
};

export type SingingStoreTypes = {
  SELECTED_TRACK_ID: {
    getter: TrackId;
  };

  SELECTED_NOTE_IDS: {
    getter: Set<NoteId>;
  };

  SETUP_SINGER: {
    action(payload: { singer: Singer }): void;
  };

  SET_SINGER: {
    mutation: { singer?: Singer; withRelated?: boolean; trackId: TrackId };
    action(payload: {
      singer?: Singer;
      withRelated?: boolean;
      trackId: TrackId;
    }): void;
  };

  SET_KEY_RANGE_ADJUSTMENT: {
    mutation: { keyRangeAdjustment: number; trackId: TrackId };
    action(payload: { keyRangeAdjustment: number; trackId: TrackId }): void;
  };

  SET_VOLUME_RANGE_ADJUSTMENT: {
    mutation: { volumeRangeAdjustment: number; trackId: TrackId };
    action(payload: { volumeRangeAdjustment: number; trackId: TrackId }): void;
  };

  SET_TPQN: {
    mutation: { tpqn: number };
    action(payload: { tpqn: number }): void;
  };

  SET_TEMPOS: {
    mutation: { tempos: Tempo[] };
    action(payload: { tempos: Tempo[] }): void;
  };

  SET_TEMPO: {
    mutation: { tempo: Tempo };
  };

  REMOVE_TEMPO: {
    mutation: { position: number };
  };

  SET_TIME_SIGNATURES: {
    mutation: { timeSignatures: TimeSignature[] };
    action(payload: { timeSignatures: TimeSignature[] }): void;
  };

  SET_TIME_SIGNATURE: {
    mutation: { timeSignature: TimeSignature };
  };

  REMOVE_TIME_SIGNATURE: {
    mutation: { measureNumber: number };
  };

  ALL_NOTE_IDS: {
    getter: Set<NoteId>;
  };

  OVERLAPPING_NOTE_IDS: {
    getter(trackId: TrackId): Set<NoteId>;
  };

  SET_NOTES: {
    mutation: { notes: Note[]; trackId: TrackId };
    action(payload: { notes: Note[]; trackId: TrackId }): void;
  };

  ADD_NOTES: {
    mutation: { notes: Note[]; trackId: TrackId };
  };

  UPDATE_NOTES: {
    mutation: { notes: Note[]; trackId: TrackId };
  };

  REMOVE_NOTES: {
    mutation: { noteIds: NoteId[]; trackId: TrackId };
  };

  SELECT_NOTES: {
    mutation: { noteIds: NoteId[] };
    action(payload: { noteIds: NoteId[] }): void;
  };

  SELECT_ALL_NOTES_IN_TRACK: {
    action({ trackId }: { trackId: TrackId }): void;
  };

  DESELECT_NOTES: {
    mutation: { noteIds: NoteId[] };
    action(payload: { noteIds: NoteId[] }): void;
  };

  DESELECT_ALL_NOTES: {
    mutation: undefined;
    action(): void;
  };

  SET_EDITING_LYRIC_NOTE_ID: {
    mutation: { noteId?: NoteId };
    action(payload: { noteId?: NoteId }): void;
  };

  SET_PITCH_EDIT_DATA: {
    mutation: { pitchArray: number[]; startFrame: number; trackId: TrackId };
    action(payload: {
      pitchArray: number[];
      startFrame: number;
      trackId: TrackId;
    }): void;
  };

  ERASE_PITCH_EDIT_DATA: {
    mutation: { startFrame: number; frameLength: number; trackId: TrackId };
  };

  CLEAR_PITCH_EDIT_DATA: {
    mutation: { trackId: TrackId };
    action(payload: { trackId: TrackId }): void;
  };

  SET_PHRASES: {
    mutation: { phrases: Map<PhraseKey, Phrase> };
  };

  SET_STATE_TO_PHRASE: {
    mutation: {
      phraseKey: PhraseKey;
      phraseState: PhraseState;
    };
  };

  SET_QUERY_KEY_TO_PHRASE: {
    mutation: {
      phraseKey: PhraseKey;
      queryKey: EditorFrameAudioQueryKey | undefined;
    };
  };

  SET_SINGING_PITCH_KEY_TO_PHRASE: {
    mutation: {
      phraseKey: PhraseKey;
      singingPitchKey: SingingPitchKey | undefined;
    };
  };

  SET_SINGING_VOLUME_KEY_TO_PHRASE: {
    mutation: {
      phraseKey: PhraseKey;
      singingVolumeKey: SingingVolumeKey | undefined;
    };
  };

  SET_SINGING_VOICE_KEY_TO_PHRASE: {
    mutation: {
      phraseKey: PhraseKey;
      singingVoiceKey: SingingVoiceKey | undefined;
    };
  };

  SET_SEQUENCE_ID_TO_PHRASE: {
    mutation: {
      phraseKey: PhraseKey;
      sequenceId: SequenceId | undefined;
    };
  };

  SET_PHRASE_QUERY: {
    mutation: {
      queryKey: EditorFrameAudioQueryKey;
      query: EditorFrameAudioQuery;
    };
  };

  DELETE_PHRASE_QUERY: {
    mutation: { queryKey: EditorFrameAudioQueryKey };
  };

  SET_PHRASE_SINGING_PITCH: {
    mutation: {
      singingPitchKey: SingingPitchKey;
      singingPitch: SingingPitch;
    };
  };

  DELETE_PHRASE_SINGING_PITCH: {
    mutation: { singingPitchKey: SingingPitchKey };
  };

  SET_PHRASE_SINGING_VOLUME: {
    mutation: {
      singingVolumeKey: SingingVolumeKey;
      singingVolume: SingingVolume;
    };
  };

  DELETE_PHRASE_SINGING_VOLUME: {
    mutation: { singingVolumeKey: SingingVolumeKey };
  };

  SELECTED_TRACK: {
    getter: Track;
  };

  SET_SNAP_TYPE: {
    mutation: { snapType: number };
    action(payload: { snapType: number }): void;
  };

  SEQUENCER_NUM_MEASURES: {
    getter: number;
  };

  SET_ZOOM_X: {
    mutation: { zoomX: number };
    action(payload: { zoomX: number }): void;
  };

  SET_ZOOM_Y: {
    mutation: { zoomY: number };
    action(payload: { zoomY: number }): void;
  };

  SET_EDIT_TARGET: {
    mutation: { editTarget: SequencerEditTarget };
    action(payload: { editTarget: SequencerEditTarget }): void;
  };

  SET_SEQUENCER_NOTE_TOOL: {
    mutation: { sequencerNoteTool: NoteEditTool };
    action(payload: { sequencerNoteTool: NoteEditTool }): void;
  };

  SET_SEQUENCER_PITCH_TOOL: {
    mutation: { sequencerPitchTool: PitchEditTool };
    action(payload: { sequencerPitchTool: PitchEditTool }): void;
  };

  EXPORT_LABEL_FILES: {
    action(payload: { dirPath?: string }): SaveResultObject[];
  };

  EXPORT_AUDIO_FILE: {
    action(payload: {
      filePath?: string;
      setting: SongExportSetting;
    }): SaveResultObject;
  };

  EXPORT_STEM_AUDIO_FILE: {
    action(payload: {
      dirPath?: string;
      setting: SongExportSetting;
    }): SaveResultObject;
  };

  GENERATE_FILE_PATH_FOR_TRACK_EXPORT: {
    action(payload: {
      trackId: TrackId;
      directoryPath: string;
      extension: string;
    }): Promise<string>;
  };

  EXPORT_FILE: {
    action(payload: {
      filePath: string;
      content: Uint8Array;
    }): Promise<SaveResultObject>;
  };

  CANCEL_EXPORT: {
    action(): void;
  };

  FETCH_SING_FRAME_VOLUME: {
    action(palyoad: {
      notes: NoteForRequestToEngine[];
      query: EditorFrameAudioQuery;
      engineId: EngineId;
      styleId: StyleId;
    }): Promise<number[]>;
  };

  TICK_TO_SECOND: {
    getter(position: number): number;
  };

  SECOND_TO_TICK: {
    getter(time: number): number;
  };

  PLAYHEAD_POSITION: {
    getter: number;
  };

  SET_PLAYHEAD_POSITION: {
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

  SET_EXPORT_STATE: {
    mutation: { exportState: SongExportState };
  };

  SET_CANCELLATION_OF_EXPORT_REQUESTED: {
    mutation: { cancellationOfExportRequested: boolean };
  };

  RENDER: {
    action(): void;
  };

  STOP_RENDERING: {
    action(): void;
  };

  COPY_NOTES_TO_CLIPBOARD: {
    action(): void;
  };

  COMMAND_CUT_NOTES_TO_CLIPBOARD: {
    action(): void;
  };

  COMMAND_PASTE_NOTES_FROM_CLIPBOARD: {
    action(): void;
  };

  COMMAND_QUANTIZE_SELECTED_NOTES: {
    action(): void;
  };

  CREATE_TRACK: {
    action(): { trackId: TrackId; track: Track };
  };

  INSERT_TRACK: {
    mutation: {
      trackId: TrackId;
      track: Track;
      prevTrackId: TrackId | undefined;
    };
    action(payload: {
      trackId: TrackId;
      track: Track;
      prevTrackId: TrackId | undefined;
    }): void;
  };

  DELETE_TRACK: {
    mutation: { trackId: TrackId };
    action(payload: { trackId: TrackId }): void;
  };

  SELECT_TRACK: {
    mutation: { trackId: TrackId };
    action(payload: { trackId: TrackId }): void;
  };

  SET_TRACK: {
    mutation: { trackId: TrackId; track: Track };
    action(payload: { trackId: TrackId; track: Track }): void;
  };

  SET_TRACKS: {
    mutation: { tracks: Map<TrackId, Track> };
    action(payload: { tracks: Map<TrackId, Track> }): Promise<void>;
  };

  SET_SONG_SIDEBAR_OPEN: {
    mutation: { isSongSidebarOpen: boolean };
    action(payload: { isSongSidebarOpen: boolean }): void;
  };

  SET_TRACK_NAME: {
    mutation: { trackId: TrackId; name: string };
    action(payload: { trackId: TrackId; name: string }): void;
  };

  SET_TRACK_MUTE: {
    mutation: { trackId: TrackId; mute: boolean };
    action(payload: { trackId: TrackId; mute: boolean }): void;
  };

  SET_TRACK_SOLO: {
    mutation: { trackId: TrackId; solo: boolean };
    action(payload: { trackId: TrackId; solo: boolean }): void;
  };

  SET_TRACK_GAIN: {
    mutation: { trackId: TrackId; gain: number };
    action(payload: { trackId: TrackId; gain: number }): void;
  };

  SET_TRACK_PAN: {
    mutation: { trackId: TrackId; pan: number };
    action(payload: { trackId: TrackId; pan: number }): void;
  };

  SET_SELECTED_TRACK: {
    mutation: { trackId: TrackId };
    action(payload: { trackId: TrackId }): void;
  };

  REORDER_TRACKS: {
    mutation: { trackOrder: TrackId[] };
    action(payload: { trackOrder: TrackId[] }): void;
  };

  UNSOLO_ALL_TRACKS: {
    mutation: undefined;
    action(): void;
  };

  CALC_RENDER_DURATION: {
    getter: number;
  };

  SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS: {
    action(): void;
  };

  APPLY_DEVICE_ID_TO_AUDIO_CONTEXT: {
    action(payload: { device: string }): void;
  };

  EXPORT_SONG_PROJECT: {
    action(payload: {
      fileType: ExportSongProjectFileType;
      fileTypeLabel: string;
    }): Promise<SaveResultObject>;
  };
};

export type SingingCommandStoreState = {
  //
};

export type SingingCommandStoreTypes = {
  COMMAND_SET_SINGER: {
    mutation: { singer: Singer; withRelated?: boolean; trackId: TrackId };
    action(payload: {
      singer: Singer;
      withRelated?: boolean;
      trackId: TrackId;
    }): void;
  };

  COMMAND_SET_KEY_RANGE_ADJUSTMENT: {
    mutation: { keyRangeAdjustment: number; trackId: TrackId };
    action(payload: { keyRangeAdjustment: number; trackId: TrackId }): void;
  };

  COMMAND_SET_VOLUME_RANGE_ADJUSTMENT: {
    mutation: { volumeRangeAdjustment: number; trackId: TrackId };
    action(payload: { volumeRangeAdjustment: number; trackId: TrackId }): void;
  };

  COMMAND_SET_TEMPO: {
    mutation: { tempo: Tempo };
    action(payload: { tempo: Tempo }): void;
  };

  COMMAND_REMOVE_TEMPO: {
    mutation: { position: number };
    action(payload: { position: number }): void;
  };

  COMMAND_SET_TIME_SIGNATURE: {
    mutation: { timeSignature: TimeSignature };
    action(payload: { timeSignature: TimeSignature }): void;
  };

  COMMAND_REMOVE_TIME_SIGNATURE: {
    mutation: { measureNumber: number };
    action(payload: { measureNumber: number }): void;
  };

  COMMAND_ADD_NOTES: {
    mutation: { notes: Note[]; trackId: TrackId };
    action(payload: { notes: Note[]; trackId: TrackId }): void;
  };

  COMMAND_UPDATE_NOTES: {
    mutation: { notes: Note[]; trackId: TrackId };
    action(payload: { notes: Note[]; trackId: TrackId }): void;
  };

  COMMAND_REMOVE_NOTES: {
    mutation: { noteIds: NoteId[]; trackId: TrackId };
    action(payload: { noteIds: NoteId[]; trackId: TrackId }): void;
  };

  COMMAND_REMOVE_SELECTED_NOTES: {
    action(): void;
  };

  COMMAND_SET_PITCH_EDIT_DATA: {
    mutation: { pitchArray: number[]; startFrame: number; trackId: TrackId };
    action(payload: {
      pitchArray: number[];
      startFrame: number;
      trackId: TrackId;
    }): void;
  };

  COMMAND_ERASE_PITCH_EDIT_DATA: {
    mutation: { startFrame: number; frameLength: number; trackId: TrackId };
    action(payload: {
      startFrame: number;
      frameLength: number;
      trackId: TrackId;
    }): void;
  };

  COMMAND_INSERT_EMPTY_TRACK: {
    mutation: {
      trackId: TrackId;
      track: Track;
      prevTrackId: TrackId;
    };
    action(payload: { prevTrackId: TrackId }): void;
  };

  COMMAND_DELETE_TRACK: {
    mutation: { trackId: TrackId };
    action(payload: { trackId: TrackId }): void;
  };

  COMMAND_SET_TRACK_NAME: {
    mutation: { trackId: TrackId; name: string };
    action(payload: { trackId: TrackId; name: string }): void;
  };

  COMMAND_SET_TRACK_MUTE: {
    mutation: { trackId: TrackId; mute: boolean };
    action(payload: { trackId: TrackId; mute: boolean }): void;
  };

  COMMAND_SET_TRACK_SOLO: {
    mutation: { trackId: TrackId; solo: boolean };
    action(payload: { trackId: TrackId; solo: boolean }): void;
  };

  COMMAND_SET_TRACK_GAIN: {
    mutation: { trackId: TrackId; gain: number };
    action(payload: { trackId: TrackId; gain: number }): void;
  };

  COMMAND_SET_TRACK_PAN: {
    mutation: { trackId: TrackId; pan: number };
    action(payload: { trackId: TrackId; pan: number }): void;
  };

  COMMAND_REORDER_TRACKS: {
    mutation: { trackOrder: TrackId[] };
    action(payload: { trackOrder: TrackId[] }): void;
  };

  COMMAND_UNSOLO_ALL_TRACKS: {
    mutation: undefined;
    action(): void;
  };

  COMMAND_IMPORT_TRACKS: {
    mutation: {
      tpqn: number;
      tempos: Tempo[];
      timeSignatures: TimeSignature[];
      tracks: ({ track: Track; trackId: TrackId } & (
        | { overwrite: true; prevTrackId?: undefined }
        | { overwrite?: false; prevTrackId: TrackId }
      ))[];
    };
    action(payload: {
      tpqn: number;
      tempos: Tempo[];
      timeSignatures: TimeSignature[];
      tracks: Track[];
    }): void;
  };

  COMMAND_IMPORT_UTAFORMATIX_PROJECT: {
    action(payload: { project: UfProject; trackIndexes: number[] }): void;
  };

  COMMAND_IMPORT_VOICEVOX_PROJECT: {
    action(payload: {
      project: LatestProjectType;
      trackIndexes: number[];
    }): void;
  };
};

/*
 * Command Store Types
 */

export type CommandStoreState = {
  undoCommands: Record<EditorType, Command[]>;
  redoCommands: Record<EditorType, Command[]>;
};

export type CommandStoreTypes = {
  CAN_UNDO: {
    getter(editor: EditorType): boolean;
  };

  CAN_REDO: {
    getter(editor: EditorType): boolean;
  };

  UNDO: {
    mutation: { editor: EditorType };
    action(payload: { editor: EditorType }): void;
  };

  REDO: {
    mutation: { editor: EditorType };
    action(payload: { editor: EditorType }): void;
  };

  LAST_COMMAND_IDS: {
    getter: Record<EditorType, CommandId | null>;
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
  PULL_AND_INIT_ENGINE_INFOS: {
    action(): void;
  };

  SET_ENGINE_INFO: {
    mutation: { engineId: EngineId; engineInfo: EngineInfo };
  };

  PULL_ENGINE_INFOS: {
    action: (payload: { engineIds: EngineId[] }) => Promise<void>;
  };

  GET_SORTED_ENGINE_INFOS: {
    getter: EngineInfo[];
  };

  PULL_ALT_PORT_INFOS: {
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

  INITIALIZE_ENGINE_CHARACTER: {
    action(payload: {
      engineId: EngineId;
      styleId: StyleId;
      uiLock: boolean;
    }): void;
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
    getter(styleType: "all" | "singerLike" | "talk"): Voice[];
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
  savedLastCommandIds: Record<EditorType, CommandId | null>;
};

export type ProjectStoreTypes = {
  PROJECT_NAME_WITH_EXT: {
    getter: string | undefined;
  };

  PROJECT_NAME: {
    getter: string | undefined;
  };

  SET_PROJECT_FILEPATH: {
    mutation: { filePath?: string };
  };

  CREATE_NEW_PROJECT: {
    action(payload: { confirm?: boolean }): void;
  };

  PARSE_PROJECT_FILE: {
    action(payload: { projectJson: string }): Promise<LatestProjectType>;
  };

  LOAD_PROJECT_FILE: {
    action(
      payload:
        | { type: "dialog" }
        | { type: "path"; filePath: string }
        | { type: "file"; file: File },
    ): boolean;
  };

  SAVE_PROJECT_FILE: {
    action(payload: { overwrite?: boolean }): boolean;
  };

  SAVE_OR_DISCARD_PROJECT_FILE: {
    action(palyoad: {
      additionalMessage?: string;
    }): "saved" | "discarded" | "canceled";
  };

  GET_INITIAL_PROJECT_FILE_PATH: {
    action(): Promise<string | undefined>;
  };

  IS_EDITED: {
    getter: boolean;
  };

  SET_SAVED_LAST_COMMAND_IDS: {
    mutation: Record<EditorType, CommandId | null>;
  };

  RESET_SAVED_LAST_COMMAND_IDS: {
    mutation: void;
  };

  CLEAR_UNDO_HISTORY: {
    action(): void;
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
  currentTheme: string;
  availableThemes: ThemeConf[];
  acceptTerms: AcceptTermsStatus;
  acceptRetrieveTelemetry: AcceptRetrieveTelemetryStatus;
  experimentalSetting: ExperimentalSettingType;
  confirmedTips: ConfirmedTips;
  engineSettings: EngineSettings;
} & Omit<RootMiscSettingType, "openedEditor"> & {
    openedEditor: EditorType | undefined; // undefinedのときはどのエディタを開くか定まっていない
  };

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

  SET_CURRENT_THEME_SETTING: {
    mutation: { currentTheme: string };
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
  isMaximized: boolean;
  isPinned: boolean;
  isFullscreen: boolean;
  progress: number;
  isVuexReady: boolean;
} & DialogStates;

export type DialogStates = {
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
  isExportSongAudioDialogOpen: boolean;
  isImportSongProjectDialogOpen: boolean;
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
    mutation: Partial<DialogStates>;
    action(payload: Partial<DialogStates>): void;
  };

  SHOW_ALERT_DIALOG: {
    action(payload: MessageDialogOptions): TextDialogResult;
  };

  SHOW_CONFIRM_DIALOG: {
    action(payload: ConfirmDialogOptions): TextDialogResult;
  };

  SHOW_WARNING_DIALOG: {
    action(payload: WarningDialogOptions): TextDialogResult;
  };

  SHOW_NOTIFY_AND_NOT_SHOW_AGAIN_BUTTON: {
    action(payload: NotifyAndNotShowAgainButtonOption): void;
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

  SET_AVAILABLE_THEMES: {
    mutation: { themes: ThemeConf[] };
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

  ZOOM_IN: {
    action(): void;
  };

  ZOOM_OUT: {
    action(): void;
  };

  ZOOM_RESET: {
    action(): void;
  };

  CHECK_EDITED_AND_NOT_SAVE: {
    action(
      obj:
        | { closeOrReload: "close" }
        | {
            closeOrReload: "reload";
            isMultiEngineOffMode?: boolean;
          },
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

  SHOW_GENERATE_AND_SAVE_ALL_AUDIO_DIALOG: {
    action(): void;
  };

  SHOW_GENERATE_AND_CONNECT_ALL_AUDIO_DIALOG: {
    action(): void;
  };

  SHOW_GENERATE_AND_SAVE_SELECTED_AUDIO_DIALOG: {
    action(): void;
  };

  SHOW_CONNECT_AND_EXPORT_TEXT_DIALOG: {
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

export type DictionaryStoreState = Record<never, unknown>;

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

export type ProxyStoreState = Record<never, unknown>;

export type IEngineConnectorFactoryActions = ReturnType<
  IEngineConnectorFactory["instance"]
>;

export type IEngineConnectorFactoryActionsMapper = <
  K extends keyof IEngineConnectorFactoryActions,
>(
  action: K,
) => (
  _: Parameters<IEngineConnectorFactoryActions[K]>[0],
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
  CommandStoreState &
  EngineStoreState &
  IndexStoreState &
  ProjectStoreState &
  SettingStoreState &
  UiStoreState &
  PresetStoreState &
  DictionaryStoreState &
  ProxyStoreState &
  SingingStoreState &
  SingingCommandStoreState;

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
  SingingStoreTypes &
  SingingCommandStoreTypes;

export type AllGetters = StoreType<AllStoreTypes, "getter">;
export type AllMutations = StoreType<AllStoreTypes, "mutation">;
export type AllActions = StoreType<AllStoreTypes, "action">;

export const commandMutationsCreator = <S, M extends MutationsBase>(
  arg: PayloadRecipeTree<S, M>,
  editor: EditorType,
): MutationTree<S, M> => createCommandMutationTree<S, M>(arg, editor);

export const transformCommandStore = <
  S,
  G extends GettersBase,
  A extends ActionsBase,
  M extends MutationsBase,
>(
  options: StoreOptions<S, G, A, M, AllGetters, AllActions, AllMutations>,
  editor: EditorType,
): StoreOptions<S, G, A, M, AllGetters, AllActions, AllMutations> => {
  if (options.mutations)
    options.mutations = commandMutationsCreator<S, M>(
      options.mutations as PayloadRecipeTree<S, M>,
      editor,
    );
  return options;
};
