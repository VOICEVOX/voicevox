import {
  FrameAudioQueryKey,
  Note,
  PhraseKey,
  Singer,
  SingingVoice,
  SingingVoiceKey,
  Tempo,
  Track,
  SingingVolumeKey,
  SingingVolume,
} from "@/store/type";
import {
  FrameAudioQuery,
  FramePhoneme,
  Note as NoteForRequestToEngine,
} from "@/openapi";
import { applyPitchEdit, decibelToLinear, tickToSecond } from "@/sing/domain";
import { calculateHash, linearInterpolation } from "@/sing/utility";
import { EngineId, StyleId, TrackId } from "@/type/preload";
import { createLogger } from "@/domain/frontend/log";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { getOrThrow } from "@/helpers/mapHelper";

const logger = createLogger("store/singing");

// リクエスト用のノーツ（と休符）を作成する
const createNotesForRequestToEngine = (
  firstRestDuration: number,
  lastRestDurationSeconds: number,
  notes: Note[],
  tempos: Tempo[],
  tpqn: number,
  frameRate: number,
) => {
  const notesForRequestToEngine: NoteForRequestToEngine[] = [];

  // 先頭の休符を変換
  const firstRestStartSeconds = tickToSecond(
    notes[0].position - firstRestDuration,
    tempos,
    tpqn,
  );
  const firstRestStartFrame = Math.round(firstRestStartSeconds * frameRate);
  const firstRestEndSeconds = tickToSecond(notes[0].position, tempos, tpqn);
  const firstRestEndFrame = Math.round(firstRestEndSeconds * frameRate);
  notesForRequestToEngine.push({
    key: undefined,
    frameLength: firstRestEndFrame - firstRestStartFrame,
    lyric: "",
  });

  // ノートを変換
  for (const note of notes) {
    const noteOnSeconds = tickToSecond(note.position, tempos, tpqn);
    const noteOnFrame = Math.round(noteOnSeconds * frameRate);
    const noteOffSeconds = tickToSecond(
      note.position + note.duration,
      tempos,
      tpqn,
    );
    const noteOffFrame = Math.round(noteOffSeconds * frameRate);
    notesForRequestToEngine.push({
      key: note.noteNumber,
      frameLength: noteOffFrame - noteOnFrame,
      lyric: note.lyric,
    });
  }

  // 末尾に休符を追加
  const lastRestFrameLength = Math.round(lastRestDurationSeconds * frameRate);
  notesForRequestToEngine.push({
    key: undefined,
    frameLength: lastRestFrameLength,
    lyric: "",
  });

  // frameLengthが1以上になるようにする
  for (let i = 0; i < notesForRequestToEngine.length; i++) {
    const frameLength = notesForRequestToEngine[i].frameLength;
    const frameToShift = Math.max(0, 1 - frameLength);
    notesForRequestToEngine[i].frameLength += frameToShift;
    if (i < notesForRequestToEngine.length - 1) {
      notesForRequestToEngine[i + 1].frameLength -= frameToShift;
    }
  }

  return notesForRequestToEngine;
};

const shiftKeyOfNotes = (notes: NoteForRequestToEngine[], keyShift: number) => {
  for (const note of notes) {
    if (note.key != undefined) {
      note.key += keyShift;
    }
  }
};

const getPhonemes = (query: FrameAudioQuery) => {
  return query.phonemes.map((value) => value.phoneme).join(" ");
};

const shiftPitch = (f0: number[], pitchShift: number) => {
  for (let i = 0; i < f0.length; i++) {
    f0[i] *= Math.pow(2, pitchShift / 12);
  }
};

const shiftVolume = (volume: number[], volumeShift: number) => {
  for (let i = 0; i < volume.length; i++) {
    volume[i] *= decibelToLinear(volumeShift);
  }
};

// 歌とpauの呼吸音が重ならないようにvolumeを制御する
// fadeOutDurationSecondsが0の場合は即座にvolumeを0にする
const muteLastPauSection = (
  volume: number[],
  phonemes: FramePhoneme[],
  frameRate: number,
  fadeOutDurationSeconds: number,
) => {
  const lastPhoneme = phonemes.at(-1);
  if (lastPhoneme == undefined || lastPhoneme.phoneme !== "pau") {
    throw new Error("No pau exists at the end.");
  }

  let lastPauStartFrame = 0;
  for (let i = 0; i < phonemes.length - 1; i++) {
    lastPauStartFrame += phonemes[i].frameLength;
  }

  const lastPauFrameLength = lastPhoneme.frameLength;
  let fadeOutFrameLength = Math.round(fadeOutDurationSeconds * frameRate);
  fadeOutFrameLength = Math.max(0, fadeOutFrameLength);
  fadeOutFrameLength = Math.min(lastPauFrameLength, fadeOutFrameLength);

  // フェードアウト処理を行う
  if (fadeOutFrameLength === 1) {
    volume[lastPauStartFrame] *= 0.5;
  } else {
    for (let i = 0; i < fadeOutFrameLength; i++) {
      volume[lastPauStartFrame + i] *= linearInterpolation(
        0,
        1,
        fadeOutFrameLength - 1,
        0,
        i,
      );
    }
  }
  // 音量を0にする
  for (let i = fadeOutFrameLength; i < lastPauFrameLength; i++) {
    volume[lastPauStartFrame + i] = 0;
  }
};

const singingTeacherStyleId = StyleId(6000); // TODO: 設定できるようにする
const lastRestDurationSeconds = 0.5; // TODO: 設定できるようにする
const fadeOutDurationSeconds = 0.15; // TODO: 設定できるようにする

type Snapshot = Readonly<{
  tpqn: number;
  tempos: Tempo[];
  tracks: Map<TrackId, Track>;
  engineFrameRates: Map<EngineId, number>;
  editFrameRate: number;
}>;

type Phrase = Readonly<{
  firstRestDuration: number;
  notes: Note[];
  startTime: number;
  queryKey: {
    get: () => FrameAudioQueryKey | undefined;
    set: (value: FrameAudioQueryKey | undefined) => void;
  };
  singingVolumeKey: {
    get: () => SingingVolumeKey | undefined;
    set: (value: SingingVolumeKey | undefined) => void;
  };
  singingVoiceKey: {
    get: () => SingingVoiceKey | undefined;
    set: (value: SingingVoiceKey | undefined) => void;
  };
}>;

type ExternalDependencies = Readonly<{
  queryCache: Map<FrameAudioQueryKey, FrameAudioQuery>;
  singingVolumeCache: Map<SingingVolumeKey, SingingVolume>;
  singingVoiceCache: Map<SingingVoiceKey, SingingVoice>;

  phrases: {
    get: (phraseKey: PhraseKey) => Phrase;
  };
  phraseQueries: {
    get: (queryKey: FrameAudioQueryKey) => FrameAudioQuery;
    set: (queryKey: FrameAudioQueryKey, query: FrameAudioQuery) => void;
    delete: (queryKey: FrameAudioQueryKey) => void;
  };
  phraseSingingVolumes: {
    get: (singingVolumeKey: SingingVolumeKey) => SingingVolume;
    set: (
      singingVolumeKey: SingingVolumeKey,
      singingVolume: SingingVolume,
    ) => void;
    delete: (singingVolumeKey: SingingVolumeKey) => void;
  };
  phraseSingingVoices: {
    set: (singingVoiceKey: SingingVoiceKey, singingVoice: SingingVoice) => void;
    delete: (singingVoiceKey: SingingVoiceKey) => void;
  };

  fetchQuery: (
    engineId: EngineId,
    notes: NoteForRequestToEngine[],
  ) => Promise<FrameAudioQuery>;
  fetchSingFrameVolume: (
    notes: NoteForRequestToEngine[],
    query: FrameAudioQuery,
    engineId: EngineId,
    styleId: StyleId,
  ) => Promise<SingingVolume>;
  synthesizeSingingVoice: (
    singer: Singer,
    query: FrameAudioQuery,
  ) => Promise<SingingVoice>;
}>;

type Context = Readonly<{
  snapshot: Snapshot;
  trackId: TrackId;
  phraseKey: PhraseKey;
  externalDependencies: ExternalDependencies;
}>;

// クエリ生成ステージ

type QuerySource = Readonly<{
  engineId: EngineId;
  engineFrameRate: number;
  tpqn: number;
  tempos: Tempo[];
  firstRestDuration: number;
  notes: Note[];
  keyRangeAdjustment: number;
}>;

type QueryGenerationStage = Readonly<{
  id: "queryGeneration";
  shouldBeExecuted: (context: Context) => Promise<boolean>;
  deleteExecutionResult: (context: Context) => void;
  execute: (context: Context) => Promise<void>;
}>;

const generateQuerySource = (context: Context): QuerySource => {
  const phrases = context.externalDependencies.phrases;

  const track = getOrThrow(context.snapshot.tracks, context.trackId);
  if (track.singer == undefined) {
    throw new Error("track.singer is undefined.");
  }
  const engineFrameRate = getOrThrow(
    context.snapshot.engineFrameRates,
    track.singer.engineId,
  );
  const phrase = phrases.get(context.phraseKey);
  return {
    engineId: track.singer.engineId,
    engineFrameRate,
    tpqn: context.snapshot.tpqn,
    tempos: context.snapshot.tempos,
    firstRestDuration: phrase.firstRestDuration,
    notes: phrase.notes,
    keyRangeAdjustment: track.keyRangeAdjustment,
  };
};

const calculateQueryKey = async (querySource: QuerySource) => {
  const hash = await calculateHash(querySource);
  return FrameAudioQueryKey(hash);
};

const generateQuery = async (
  querySource: QuerySource,
  externalDependencies: ExternalDependencies,
) => {
  const notesForRequestToEngine = createNotesForRequestToEngine(
    querySource.firstRestDuration,
    lastRestDurationSeconds,
    querySource.notes,
    querySource.tempos,
    querySource.tpqn,
    querySource.engineFrameRate,
  );

  shiftKeyOfNotes(notesForRequestToEngine, -querySource.keyRangeAdjustment);

  const query = await externalDependencies.fetchQuery(
    querySource.engineId,
    notesForRequestToEngine,
  );

  shiftPitch(query.f0, querySource.keyRangeAdjustment);
  return query;
};

const queryGenerationStage: QueryGenerationStage = {
  id: "queryGeneration",
  shouldBeExecuted: async (context: Context) => {
    const phrases = context.externalDependencies.phrases;

    const track = getOrThrow(context.snapshot.tracks, context.trackId);
    if (track.singer == undefined) {
      return false;
    }
    const phrase = phrases.get(context.phraseKey);
    const phraseQueryKey = phrase.queryKey.get();
    const querySource = generateQuerySource(context);
    const queryKey = await calculateQueryKey(querySource);
    return phraseQueryKey == undefined || phraseQueryKey !== queryKey;
  },
  deleteExecutionResult: (context: Context) => {
    const phrases = context.externalDependencies.phrases;
    const phraseQueries = context.externalDependencies.phraseQueries;

    const phrase = phrases.get(context.phraseKey);
    const phraseQueryKey = phrase.queryKey.get();
    if (phraseQueryKey != undefined) {
      phraseQueries.delete(phraseQueryKey);
      phrase.queryKey.set(undefined);
    }
  },
  execute: async (context: Context) => {
    const phrases = context.externalDependencies.phrases;
    const phraseQueries = context.externalDependencies.phraseQueries;
    const queryCache = context.externalDependencies.queryCache;

    const querySource = generateQuerySource(context);
    const queryKey = await calculateQueryKey(querySource);

    let query = queryCache.get(queryKey);
    if (query != undefined) {
      logger.info(`Loaded query from cache.`);
    } else {
      query = await generateQuery(querySource, context.externalDependencies);
      const phonemes = getPhonemes(query);
      logger.info(`Generated query. phonemes: ${phonemes}`);
      queryCache.set(queryKey, query);
    }

    const phrase = phrases.get(context.phraseKey);
    const phraseQueryKey = phrase.queryKey.get();
    if (phraseQueryKey != undefined) {
      phraseQueries.delete(phraseQueryKey);
    }
    phraseQueries.set(queryKey, query);
    phrase.queryKey.set(queryKey);
  },
};

// 歌唱ボリューム生成ステージ

type SingingVolumeSource = Readonly<{
  engineId: EngineId;
  engineFrameRate: number;
  tpqn: number;
  tempos: Tempo[];
  firstRestDuration: number;
  notes: Note[];
  keyRangeAdjustment: number;
  volumeRangeAdjustment: number;
  queryForVolumeGeneration: FrameAudioQuery;
}>;

type SingingVolumeGenerationStage = Readonly<{
  id: "singingVolumeGeneration";
  shouldBeExecuted: (context: Context) => Promise<boolean>;
  deleteExecutionResult: (context: Context) => void;
  execute: (context: Context) => Promise<void>;
}>;

const generateSingingVolumeSource = (context: Context): SingingVolumeSource => {
  const phrases = context.externalDependencies.phrases;
  const phraseQueries = context.externalDependencies.phraseQueries;

  const track = getOrThrow(context.snapshot.tracks, context.trackId);
  if (track.singer == undefined) {
    throw new Error("track.singer is undefined.");
  }
  const engineFrameRate = getOrThrow(
    context.snapshot.engineFrameRates,
    track.singer.engineId,
  );
  const phrase = phrases.get(context.phraseKey);
  const phraseQueryKey = phrase.queryKey.get();
  if (phraseQueryKey == undefined) {
    throw new Error("phraseQueryKey is undefined.");
  }
  const query = phraseQueries.get(phraseQueryKey);
  const clonedQuery = cloneWithUnwrapProxy(query);
  applyPitchEdit(
    {
      query: clonedQuery,
      startTime: phrase.startTime,
      frameRate: engineFrameRate,
    },
    track.pitchEditData,
    context.snapshot.editFrameRate,
  );
  return {
    engineId: track.singer.engineId,
    engineFrameRate,
    tpqn: context.snapshot.tpqn,
    tempos: context.snapshot.tempos,
    firstRestDuration: phrase.firstRestDuration,
    notes: phrase.notes,
    keyRangeAdjustment: track.keyRangeAdjustment,
    volumeRangeAdjustment: track.volumeRangeAdjustment,
    queryForVolumeGeneration: clonedQuery,
  };
};

const calculateSingingVolumeKey = async (
  singingVolumeSource: SingingVolumeSource,
) => {
  const hash = await calculateHash(singingVolumeSource);
  return SingingVolumeKey(hash);
};

const generateSingingVolume = async (
  singingVolumeSource: SingingVolumeSource,
  externalDependencies: ExternalDependencies,
) => {
  const notesForRequestToEngine = createNotesForRequestToEngine(
    singingVolumeSource.firstRestDuration,
    lastRestDurationSeconds,
    singingVolumeSource.notes,
    singingVolumeSource.tempos,
    singingVolumeSource.tpqn,
    singingVolumeSource.engineFrameRate,
  );
  const queryForVolumeGeneration = singingVolumeSource.queryForVolumeGeneration;

  shiftKeyOfNotes(
    notesForRequestToEngine,
    -singingVolumeSource.keyRangeAdjustment,
  );
  shiftPitch(
    queryForVolumeGeneration.f0,
    -singingVolumeSource.keyRangeAdjustment,
  );

  const singingVolume = await externalDependencies.fetchSingFrameVolume(
    notesForRequestToEngine,
    queryForVolumeGeneration,
    singingVolumeSource.engineId,
    singingTeacherStyleId,
  );

  shiftVolume(singingVolume, singingVolumeSource.volumeRangeAdjustment);

  // 末尾のpauの区間の音量を0にする
  muteLastPauSection(
    singingVolume,
    queryForVolumeGeneration.phonemes,
    singingVolumeSource.engineFrameRate,
    fadeOutDurationSeconds,
  );
  return singingVolume;
};

const singingVolumeGenerationStage: SingingVolumeGenerationStage = {
  id: "singingVolumeGeneration",
  shouldBeExecuted: async (context: Context) => {
    const phrases = context.externalDependencies.phrases;

    const track = getOrThrow(context.snapshot.tracks, context.trackId);
    if (track.singer == undefined) {
      return false;
    }
    const singingVolumeSource = generateSingingVolumeSource(context);
    const singingVolumeKey =
      await calculateSingingVolumeKey(singingVolumeSource);
    const phrase = phrases.get(context.phraseKey);
    const phraseSingingVolumeKey = phrase.singingVolumeKey.get();
    return (
      phraseSingingVolumeKey == undefined ||
      phraseSingingVolumeKey !== singingVolumeKey
    );
  },
  deleteExecutionResult: (context: Context) => {
    const phrases = context.externalDependencies.phrases;
    const phraseSingingVolumes =
      context.externalDependencies.phraseSingingVolumes;

    const phrase = phrases.get(context.phraseKey);
    const phraseSingingVolumeKey = phrase.singingVolumeKey.get();
    if (phraseSingingVolumeKey != undefined) {
      phraseSingingVolumes.delete(phraseSingingVolumeKey);
      phrase.singingVolumeKey.set(undefined);
    }
  },
  execute: async (context: Context) => {
    const phrases = context.externalDependencies.phrases;
    const phraseSingingVolumes =
      context.externalDependencies.phraseSingingVolumes;
    const singingVolumeCache = context.externalDependencies.singingVolumeCache;

    const singingVolumeSource = generateSingingVolumeSource(context);
    const singingVolumeKey =
      await calculateSingingVolumeKey(singingVolumeSource);

    let singingVolume = singingVolumeCache.get(singingVolumeKey);
    if (singingVolume != undefined) {
      logger.info(`Loaded singing volume from cache.`);
    } else {
      singingVolume = await generateSingingVolume(
        singingVolumeSource,
        context.externalDependencies,
      );
      logger.info(`Generated singing volume.`);
      singingVolumeCache.set(singingVolumeKey, singingVolume);
    }

    const phrase = phrases.get(context.phraseKey);
    const phraseSingingVolumeKey = phrase.singingVolumeKey.get();
    if (phraseSingingVolumeKey != undefined) {
      phraseSingingVolumes.delete(phraseSingingVolumeKey);
    }
    phraseSingingVolumes.set(singingVolumeKey, singingVolume);
    phrase.singingVolumeKey.set(singingVolumeKey);
  },
};

// 音声合成ステージ

type SingingVoiceSource = Readonly<{
  singer: Singer;
  queryForSingingVoiceSynthesis: FrameAudioQuery;
}>;

type SingingVoiceSynthesisStage = Readonly<{
  id: "singingVoiceSynthesis";
  shouldBeExecuted: (context: Context) => Promise<boolean>;
  deleteExecutionResult: (context: Context) => void;
  execute: (context: Context) => Promise<void>;
}>;

const generateSingingVoiceSource = (context: Context): SingingVoiceSource => {
  const phrases = context.externalDependencies.phrases;
  const phraseQueries = context.externalDependencies.phraseQueries;
  const phraseSingingVolumes =
    context.externalDependencies.phraseSingingVolumes;

  const track = getOrThrow(context.snapshot.tracks, context.trackId);
  if (track.singer == undefined) {
    throw new Error("track.singer is undefined.");
  }
  const engineFrameRate = getOrThrow(
    context.snapshot.engineFrameRates,
    track.singer.engineId,
  );
  const phrase = phrases.get(context.phraseKey);
  const phraseQueryKey = phrase.queryKey.get();
  const phraseSingingVolumeKey = phrase.singingVolumeKey.get();
  if (phraseQueryKey == undefined) {
    throw new Error("phraseQueryKey is undefined.");
  }
  if (phraseSingingVolumeKey == undefined) {
    throw new Error("phraseSingingVolumeKey is undefined.");
  }
  const query = phraseQueries.get(phraseQueryKey);
  const singingVolume = phraseSingingVolumes.get(phraseSingingVolumeKey);
  const clonedQuery = cloneWithUnwrapProxy(query);
  const clonedSingingVolume = cloneWithUnwrapProxy(singingVolume);
  applyPitchEdit(
    {
      query: clonedQuery,
      startTime: phrase.startTime,
      frameRate: engineFrameRate,
    },
    track.pitchEditData,
    context.snapshot.editFrameRate,
  );
  clonedQuery.volume = clonedSingingVolume;
  return {
    singer: track.singer,
    queryForSingingVoiceSynthesis: clonedQuery,
  };
};

const calculateSingingVoiceKey = async (
  singingVoiceSource: SingingVoiceSource,
) => {
  const hash = await calculateHash(singingVoiceSource);
  return SingingVoiceKey(hash);
};

const synthesizeSingingVoice = async (
  singingVoiceSource: SingingVoiceSource,
  externalDependencies: ExternalDependencies,
) => {
  const singingVoice = await externalDependencies.synthesizeSingingVoice(
    singingVoiceSource.singer,
    singingVoiceSource.queryForSingingVoiceSynthesis,
  );
  return singingVoice;
};

const singingVoiceSynthesisStage: SingingVoiceSynthesisStage = {
  id: "singingVoiceSynthesis",
  shouldBeExecuted: async (context: Context) => {
    const phrases = context.externalDependencies.phrases;

    const track = getOrThrow(context.snapshot.tracks, context.trackId);
    if (track.singer == undefined) {
      return false;
    }
    const singingVoiceSource = generateSingingVoiceSource(context);
    const singingVoiceKey = await calculateSingingVoiceKey(singingVoiceSource);
    const phrase = phrases.get(context.phraseKey);
    const phraseSingingVoiceKey = phrase.singingVoiceKey.get();
    return (
      phraseSingingVoiceKey == undefined ||
      phraseSingingVoiceKey !== singingVoiceKey
    );
  },
  deleteExecutionResult: (context: Context) => {
    const phrases = context.externalDependencies.phrases;
    const phraseSingingVoices =
      context.externalDependencies.phraseSingingVoices;

    const phrase = phrases.get(context.phraseKey);
    const phraseSingingVoiceKey = phrase.singingVoiceKey.get();
    if (phraseSingingVoiceKey != undefined) {
      phraseSingingVoices.delete(phraseSingingVoiceKey);
      phrase.singingVoiceKey.set(undefined);
    }
  },
  execute: async (context: Context) => {
    const phrases = context.externalDependencies.phrases;
    const phraseSingingVoices =
      context.externalDependencies.phraseSingingVoices;
    const singingVoiceCache = context.externalDependencies.singingVoiceCache;

    const singingVoiceSource = generateSingingVoiceSource(context);
    const singingVoiceKey = await calculateSingingVoiceKey(singingVoiceSource);

    let singingVoice = singingVoiceCache.get(singingVoiceKey);
    if (singingVoice != undefined) {
      logger.info(`Loaded singing voice from cache.`);
    } else {
      singingVoice = await synthesizeSingingVoice(
        singingVoiceSource,
        context.externalDependencies,
      );
      logger.info(`Generated singing voice.`);
      singingVoiceCache.set(singingVoiceKey, singingVoice);
    }

    const phrase = phrases.get(context.phraseKey);
    const phraseSingingVoiceKey = phrase.singingVoiceKey.get();
    if (phraseSingingVoiceKey != undefined) {
      phraseSingingVoices.delete(phraseSingingVoiceKey);
    }
    phraseSingingVoices.set(singingVoiceKey, singingVoice);
    phrase.singingVoiceKey.set(singingVoiceKey);
  },
};

// フレーズレンダラー

const stages = [
  queryGenerationStage,
  singingVolumeGenerationStage,
  singingVoiceSynthesisStage,
] as const;

export type PhraseRenderStageId = (typeof stages)[number]["id"];

export const createPhraseRenderer = (
  externalDependencies: ExternalDependencies,
) => {
  return {
    getFirstRenderStageId: () => {
      return stages[0].id;
    },
    determineStartStage: async (
      snapshot: Snapshot,
      trackId: TrackId,
      phraseKey: PhraseKey,
    ) => {
      const context: Context = {
        snapshot,
        trackId,
        phraseKey,
        externalDependencies,
      };
      for (const stage of stages) {
        if (await stage.shouldBeExecuted(context)) {
          return stage.id;
        }
      }
      return undefined;
    },
    render: async (
      snapshot: Snapshot,
      trackId: TrackId,
      phraseKey: PhraseKey,
      startStageId: PhraseRenderStageId,
    ) => {
      const context: Context = {
        snapshot,
        trackId,
        phraseKey,
        externalDependencies,
      };
      const startStageIndex = stages.findIndex((value) => {
        return value.id === startStageId;
      });
      if (startStageIndex === -1) {
        throw new Error("Stage not found.");
      }
      for (let i = stages.length - 1; i >= startStageIndex; i--) {
        stages[i].deleteExecutionResult(context);
      }
      for (let i = startStageIndex; i < stages.length; i++) {
        await stages[i].execute(context);
      }
    },
  } as const;
};
