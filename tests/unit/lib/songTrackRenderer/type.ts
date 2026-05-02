import type { Note } from "@/domain/project/type";
import type {
  EditorFrameAudioQueryKey,
  PhraseKey,
  SingingPitchKey,
  SingingVoiceKey,
  SingingVolumeKey,
} from "@/store/type";
import type { TrackId } from "@/type/preload";

/**
 * テスト検証用のフレーズ情報。
 */
export type PhraseInfo = {
  readonly notes: Note[];
  readonly startTime: number;
  readonly trackId: TrackId;
  readonly queryKey?: EditorFrameAudioQueryKey;
  readonly queryHash?: string;
  readonly singingPitchKey?: SingingPitchKey;
  readonly singingPitchHash?: string;
  readonly singingVolumeKey?: SingingVolumeKey;
  readonly singingVolumeHash?: string;
  readonly singingVoiceKey?: SingingVoiceKey;
  readonly singingVoiceHash?: string;
};

/**
 * フレーズの範囲情報（開始・終了tick）。
 */
export type PhraseRangeInfo = {
  readonly startTicks: number;
  readonly endTicks: number;
};

/**
 * テスト検証用の PhrasesGeneratedEvent 情報。
 */
type PhrasesGeneratedEventInfo = {
  readonly type: "phrasesGenerated";
  readonly phraseInfos: Map<PhraseKey, PhraseInfo>;
};

/**
 * テスト検証用の CacheLoadedEvent 情報。
 */
type CacheLoadedEventInfo = {
  readonly type: "cacheLoaded";
  readonly phraseInfos: Map<PhraseKey, PhraseInfo>;
};

/**
 * テスト検証用の PhraseRenderingStartedEvent 情報。
 */
type PhraseRenderingStartedEventInfo = {
  readonly type: "phraseRenderingStarted";
  readonly phraseKey: PhraseKey;
};

/**
 * テスト検証用の QueryGenerationCompleteEvent 情報。
 */
type QueryGenerationCompleteEventInfo = {
  readonly type: "queryGenerationComplete";
  readonly phraseKey: PhraseKey;
  readonly queryKey: EditorFrameAudioQueryKey;
  readonly queryHash: string;
};

/**
 * テスト検証用の PitchGenerationCompleteEvent 情報。
 */
type PitchGenerationCompleteEventInfo = {
  readonly type: "pitchGenerationComplete";
  readonly phraseKey: PhraseKey;
  readonly singingPitchKey: SingingPitchKey;
  readonly singingPitchHash: string;
};

/**
 * テスト検証用の VolumeGenerationCompleteEvent 情報。
 */
type VolumeGenerationCompleteEventInfo = {
  readonly type: "volumeGenerationComplete";
  readonly phraseKey: PhraseKey;
  readonly singingVolumeKey: SingingVolumeKey;
  readonly singingVolumeHash: string;
};

/**
 * テスト検証用の VoiceSynthesisCompleteEvent 情報。
 */
type VoiceSynthesisCompleteEventInfo = {
  readonly type: "voiceSynthesisComplete";
  readonly phraseKey: PhraseKey;
  readonly singingVoiceKey: SingingVoiceKey;
  readonly singingVoiceHash: string;
};

/**
 * テスト検証用の PhraseRenderingCompleteEvent 情報。
 */
type PhraseRenderingCompleteEventInfo = {
  readonly type: "phraseRenderingComplete";
  readonly phraseKey: PhraseKey;
  readonly phraseInfo: PhraseInfo;
};

/**
 * テスト検証用の PhraseRenderingErrorEvent 情報。
 */
type PhraseRenderingErrorEventInfo = {
  readonly type: "phraseRenderingError";
  readonly phraseKey: PhraseKey;
  readonly error: unknown;
};

export type RenderingEventInfo =
  | PhrasesGeneratedEventInfo
  | CacheLoadedEventInfo
  | PhraseRenderingStartedEventInfo
  | QueryGenerationCompleteEventInfo
  | PitchGenerationCompleteEventInfo
  | VolumeGenerationCompleteEventInfo
  | VoiceSynthesisCompleteEventInfo
  | PhraseRenderingCompleteEventInfo
  | PhraseRenderingErrorEventInfo;

/**
 * テスト検証用のレンダリング結果情報。
 */
export type RenderingResultInfo =
  | {
      readonly type: "complete";
      readonly phraseInfos: Map<PhraseKey, PhraseInfo>;
    }
  | {
      readonly type: "interrupted";
    };
