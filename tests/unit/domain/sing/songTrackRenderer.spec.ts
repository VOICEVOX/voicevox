import { beforeEach, describe, expect, test } from "vitest";
import { hash } from "../../utils";
import { resetMockMode, uuid4 } from "@/helpers/random";
import { createOpenAPIEngineMock } from "@/mock/engineMock";
import {
  PhraseForRender,
  SongTrackRenderer,
  SongTrackRenderingEvent,
  SongTrackRenderingResult,
} from "@/sing/songTrackRendering";
import { EngineId, NoteId, StyleId, TrackId } from "@/type/preload";
import {
  createDefaultTempo,
  createDefaultTrack,
  DEFAULT_TPQN,
} from "@/sing/domain";
import { getOverlappingNoteIds } from "@/sing/storeHelper";
import {
  EditorFrameAudioQueryKey,
  Note,
  PhraseKey,
  Singer,
  SingingPitchKey,
  SingingVoice,
  SingingVoiceKey,
  SingingVolumeKey,
  Track,
} from "@/store/type";
import { calculateHash, getLast } from "@/sing/utility";
import { ExhaustiveError, UnreachableError } from "@/type/utility";
import { getOrThrow } from "@/helpers/mapHelper";

/**
 * テスト検証用のフレーズ情報。
 */
type PhraseInfo = {
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
type PhraseRangeInfo = {
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

type RenderingEventInfo =
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
type RenderingResultInfo =
  | {
      readonly type: "complete";
      readonly phraseInfos: Map<PhraseKey, PhraseInfo>;
    }
  | {
      readonly type: "interrupted";
    };

// テストで使用する共通の定数
const tpqn = DEFAULT_TPQN;
const tempos = [createDefaultTempo(0)];
const engineId = EngineId("mock");
const singingTeacherStyleId = StyleId(0);
const singerStyleId = StyleId(0);
const frameRate = 93.75;

/**
 * モックエンジンAPIを使用して SongTrackRenderer のインスタンスを生成する。
 *
 * @param playheadPositionGetter 再生ヘッド位置を取得する関数。
 * @returns SongTrackRenderer のインスタンス。
 */
const createSongTrackRendererUsingMock = ({
  playheadPositionGetter,
}: {
  playheadPositionGetter: () => number;
}) => {
  const mock = createOpenAPIEngineMock();

  const songTrackRenderer = new SongTrackRenderer({
    config: {
      singingTeacherStyleId,
      lastRestDurationSeconds: 0.5,
      fadeOutDurationSeconds: 0.15,
      firstRestMinDurationSeconds: 0.12,
    },
    engineSongApi: {
      fetchFrameAudioQuery: async (args) => {
        const query = await mock.singFrameAudioQuery({
          speaker: 0,
          score: { notes: args.notes },
        });
        return { ...query, frameRate };
      },
      fetchSingFrameF0: async (args) => {
        return await mock.singFrameF0({
          speaker: 0,
          bodySingFrameF0SingFrameF0Post: {
            score: { notes: args.notes },
            frameAudioQuery: args.query,
          },
        });
      },
      fetchSingFrameVolume: async (args) => {
        return await mock.singFrameVolume({
          speaker: 0,
          bodySingFrameVolumeSingFrameVolumePost: {
            score: { notes: args.notes },
            frameAudioQuery: args.query,
          },
        });
      },
      frameSynthesis: async (args) => {
        return await mock.frameSynthesis({
          speaker: 0,
          frameAudioQuery: args.query,
        });
      },
    },
    playheadPositionGetter,
  });

  return songTrackRenderer;
};

/**
 * テスト用のスナップショットオブジェクトを生成する。
 *
 * @param trackEntries トラックIDとトラック情報（シンガー、ノーツ）のエントリー配列。
 * @returns スナップショットオブジェクト。
 */
const createSnapshot = (
  trackEntries: [TrackId, { singer?: Singer; notes: Note[] }][],
) => {
  const tracks = new Map<TrackId, Track>();
  for (const trackEntry of trackEntries) {
    tracks.set(trackEntry[0], {
      ...createDefaultTrack(),
      ...trackEntry[1],
    });
  }

  const trackOverlappingNoteIds = new Map(
    [...tracks.entries()].map(([trackId, track]) => [
      trackId,
      getOverlappingNoteIds(track.notes),
    ]),
  );

  return {
    tpqn,
    tempos,
    tracks,
    trackOverlappingNoteIds,
    engineFrameRates: new Map([[engineId, frameRate]]),
    editorFrameRate: frameRate,
  };
};

/**
 * SingingVoiceオブジェクトからハッシュ値を計算する。
 *
 * @param singingVoice 歌声オブジェクト。
 * @returns ハッシュ値のPromise。
 */
const calculateSingingVoiceHash = async (singingVoice: SingingVoice) => {
  return await hash(await singingVoice.arrayBuffer());
};

/**
 * PhraseForRender オブジェクトをテスト検証用の PhraseInfo オブジェクトに変換する。
 * 各レンダリング成果物のハッシュ値も計算して含める。
 *
 * @param phrase PhraseForRender オブジェクト。
 * @returns PhraseInfo オブジェクトのPromise。
 */
const toPhraseInfo = async (phrase: PhraseForRender): Promise<PhraseInfo> => {
  return {
    notes: phrase.notes,
    startTime: phrase.startTime,
    trackId: phrase.trackId,
    queryKey: phrase.queryKey,
    queryHash:
      phrase.query != undefined ? await calculateHash(phrase.query) : undefined,
    singingPitchKey: phrase.singingPitchKey,
    singingPitchHash:
      phrase.singingPitch != undefined
        ? await calculateHash(phrase.singingPitch)
        : undefined,
    singingVolumeKey: phrase.singingVolumeKey,
    singingVolumeHash:
      phrase.singingVolume != undefined
        ? await calculateHash(phrase.singingVolume)
        : undefined,
    singingVoiceKey: phrase.singingVoiceKey,
    singingVoiceHash:
      phrase.singingVoice != undefined
        ? await calculateSingingVoiceHash(phrase.singingVoice)
        : undefined,
  };
};

/**
 * PhraseForRender の Map を PhraseInfo の Map に変換する。
 *
 * @param phrases PhraseForRender の Map。
 * @returns PhraseInfo の Map のPromise。
 */
const toPhraseInfos = async (phrases: Map<PhraseKey, PhraseForRender>) => {
  const phraseInfos = new Map<PhraseKey, PhraseInfo>();
  for (const [phraseKey, phrase] of phrases) {
    phraseInfos.set(phraseKey, await toPhraseInfo(phrase));
  }
  return phraseInfos;
};

/**
 * SongTrackRenderingEvent をテスト検証用の RenderingEventInfo に変換する。
 * イベントの種類に応じて、関連データのハッシュ値などを計算して含める。
 *
 * @param event SongTrackRenderingEvent。
 * @returns RenderingEventInfo のPromise。
 */
const toRenderingEventInfo = async (
  event: SongTrackRenderingEvent,
): Promise<RenderingEventInfo> => {
  if (event.type === "phrasesGenerated") {
    return {
      type: event.type,
      phraseInfos: await toPhraseInfos(event.phrases),
    };
  } else if (event.type === "cacheLoaded") {
    return {
      type: event.type,
      phraseInfos: await toPhraseInfos(event.phrases),
    };
  } else if (event.type === "phraseRenderingStarted") {
    return event;
  } else if (event.type === "queryGenerationComplete") {
    return {
      type: event.type,
      phraseKey: event.phraseKey,
      queryKey: event.queryKey,
      queryHash: await calculateHash(event.query),
    };
  } else if (event.type === "pitchGenerationComplete") {
    return {
      type: event.type,
      phraseKey: event.phraseKey,
      singingPitchKey: event.singingPitchKey,
      singingPitchHash: await calculateHash(event.singingPitch),
    };
  } else if (event.type === "volumeGenerationComplete") {
    return {
      type: event.type,
      phraseKey: event.phraseKey,
      singingVolumeKey: event.singingVolumeKey,
      singingVolumeHash: await calculateHash(event.singingVolume),
    };
  } else if (event.type === "voiceSynthesisComplete") {
    return {
      type: event.type,
      phraseKey: event.phraseKey,
      singingVoiceKey: event.singingVoiceKey,
      singingVoiceHash: await calculateSingingVoiceHash(event.singingVoice),
    };
  } else if (event.type === "phraseRenderingComplete") {
    return {
      type: event.type,
      phraseKey: event.phraseKey,
      phraseInfo: await toPhraseInfo(event.phrase),
    };
  } else if (event.type === "phraseRenderingError") {
    return event;
  } else {
    throw new ExhaustiveError(event);
  }
};

/**
 * SongTrackRenderingResult をテスト検証用の RenderingResultInfo に変換する。
 *
 * @param result SongTrackRenderingResult。
 * @returns RenderingResultInfo のPromise。
 */
const toRenderingResultInfo = async (
  result: SongTrackRenderingResult,
): Promise<RenderingResultInfo> => {
  if (result.type === "complete") {
    return {
      type: result.type,
      phraseInfos: await toPhraseInfos(result.phrases),
    };
  } else if (result.type === "interrupted") {
    return result;
  } else {
    throw new ExhaustiveError(result);
  }
};

/**
 * 指定されたパターン番号に基づいてテスト用のノーツを生成する。
 *
 * @param patternNumber ノートパターンの番号。
 * @returns ノーツ。
 */
const createTestNotes = (patternNumber: number) => {
  const quarterNoteDuration = tpqn;

  const patterns = new Map([
    [0, { lyrics: "てすと", noteNumbers: [60, 62, 64] }],
    [1, { lyrics: "いち", noteNumbers: [60, 60] }],
    [2, { lyrics: "に", noteNumbers: [62] }],
    [3, { lyrics: "さん", noteNumbers: [64, 64] }],
    [4, { lyrics: "し", noteNumbers: [65] }],
    [5, { lyrics: "ご", noteNumbers: [67] }],
    [6, { lyrics: "ろく", noteNumbers: [69, 69] }],
    [7, { lyrics: "なな", noteNumbers: [71, 71] }],
    [8, { lyrics: "はち", noteNumbers: [72, 72] }],
  ]);
  const pattern = getOrThrow(patterns, patternNumber);

  const notes: Note[] = [];

  for (let i = 0; i < pattern.lyrics.length; i++) {
    if (pattern.lyrics.length !== pattern.noteNumbers.length) {
      throw new Error("The number of noteNumbers and lyrics does not match.");
    }
    notes.push({
      id: NoteId(uuid4()),
      position: quarterNoteDuration * i,
      duration: quarterNoteDuration,
      noteNumber: pattern.noteNumbers[i],
      lyric: pattern.lyrics[i],
    });
  }

  return notes;
};

/**
 * 不正な歌詞（クエリの生成でエラーになる歌詞）を持つテスト用ノーツを生成する。
 *
 * @returns ノーツ。
 */
const createTestNotesWithInvalidLyrics = (): Note[] => {
  const quarterNoteDuration = tpqn;

  return [
    {
      id: NoteId(uuid4()),
      position: 0,
      duration: quarterNoteDuration,
      noteNumber: 60,
      lyric: "て",
    },
    {
      id: NoteId(uuid4()),
      position: quarterNoteDuration,
      duration: quarterNoteDuration,
      noteNumber: 62,
      lyric: "すと",
    },
  ];
};

/**
 * ノートの終了位置（Tick）を取得する。
 *
 * @param note 対象のノート。
 * @returns ノートの終了位置。
 */
const getNoteEndPos = (note: Note) => {
  return note.position + note.duration;
};

/**
 * 複数のノーツの配列（フレーズ群）を、間に休符を挟んで連結する。
 *
 * @param notesArray 連結するノーツの配列。
 * @returns 連結後のノーツ。
 */
const joinNotesWithRest = (notesArray: Note[][]) => {
  const quarterNoteDuration = tpqn;

  const newNotes: Note[] = [];
  let position = 0;

  for (const notes of notesArray) {
    for (const note of notes) {
      newNotes.push({ ...note, position: position + note.position });
    }

    const lastNote = getLast(newNotes);
    const lastNoteEndPos = getNoteEndPos(lastNote);

    position = lastNoteEndPos + quarterNoteDuration;
  }

  return newNotes;
};

/**
 * ノーツ全体を1小節分右（後ろ）にシフトする。
 *
 * @param notes シフトするノーツ。
 * @returns シフト後のノーツ。
 */
const shiftNotesByOneMeasures = (notes: Note[]): Note[] => {
  const oneMeasureDuration = tpqn * 4;

  return notes.map((note) => ({
    ...note,
    position: note.position + oneMeasureDuration,
  }));
};

/**
 * ノーツをフレーズ（ノーツ）の配列に分割する。
 * ノート間に休符がある場合に新しいフレーズとして分割する。
 *
 * @param notes 分割対象のノーツ。
 * @returns フレーズ（ノーツ）の配列。
 */
const separateNotesIntoPhrases = (notes: Note[]) => {
  const notesArray: Note[][] = [];

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];

    if (i === 0 || getNoteEndPos(notes[i - 1]) < note.position) {
      notesArray.push([note]);
    } else {
      getLast(notesArray).push(note);
    }
  }

  return notesArray;
};

/**
 * ノーツから各フレーズの範囲情報（開始・終了Tick）を取得する。
 *
 * @param notes 対象のノーツ。
 * @returns フレーズ範囲情報の配列。
 */
const getPhraseRangeInfos = (notes: Note[]): PhraseRangeInfo[] => {
  const notesArray = separateNotesIntoPhrases(notes);

  return notesArray.map((notes) => ({
    startTicks: notes[0].position,
    endTicks: getNoteEndPos(getLast(notes)),
  }));
};

beforeEach(() => {
  resetMockMode();
});

describe("SongTrackRenderer", () => {
  test("正しいレンダリング結果が返される", async () => {
    const trackId = TrackId(uuid4());
    const notesArray = [
      createTestNotes(0),
      createTestNotes(1),
      createTestNotes(2),
    ];

    const songTrackRenderer = createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    const snapshot = createSnapshot([
      [
        trackId,
        {
          singer: { engineId, styleId: singerStyleId },
          notes: shiftNotesByOneMeasures(joinNotesWithRest(notesArray)),
        },
      ],
    ]);
    const result = await songTrackRenderer.render(snapshot);

    const renderingResultInfo = await toRenderingResultInfo(result);

    expect({ renderingResultInfo }).toMatchSnapshot();
  });

  test("レンダリングイベントが正しく発行される", async () => {
    const trackId = TrackId(uuid4());
    const notesArray = [
      createTestNotes(0),
      createTestNotes(1),
      createTestNotes(2),
    ];

    const songTrackRenderer = createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(toRenderingEventInfo(event));
    });

    const snapshot = createSnapshot([
      [
        trackId,
        {
          singer: { engineId, styleId: singerStyleId },
          notes: shiftNotesByOneMeasures(joinNotesWithRest(notesArray)),
        },
      ],
    ]);
    await songTrackRenderer.render(snapshot);

    const renderingEventInfos = await Promise.all(renderingEventInfoPromises);

    expect({ renderingEventInfos }).toMatchSnapshot();
  });

  test("キャッシュがロードされる", async () => {
    const trackId = TrackId(uuid4());
    const notesArray = [
      createTestNotes(0),
      createTestNotes(1),
      createTestNotes(2),
    ];

    const songTrackRenderer = createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(toRenderingEventInfo(event));
    });

    // 1回目のレンダリング
    const snapshot1 = createSnapshot([
      [
        trackId,
        {
          singer: { engineId, styleId: singerStyleId },
          notes: shiftNotesByOneMeasures(joinNotesWithRest(notesArray)),
        },
      ],
    ]);
    const result1 = await songTrackRenderer.render(snapshot1);

    // 2番目のフレーズのノーツを変更
    notesArray[1] = createTestNotes(3);

    // 2回目のレンダリング
    const snapshot2 = createSnapshot([
      [
        trackId,
        {
          singer: { engineId, styleId: singerStyleId },
          notes: shiftNotesByOneMeasures(joinNotesWithRest(notesArray)),
        },
      ],
    ]);
    await songTrackRenderer.render(snapshot2);

    const renderingEventInfos = await Promise.all(renderingEventInfoPromises);

    // 1回目のレンダリング結果からフレーズ情報を取得
    const resultInfo1 = await toRenderingResultInfo(result1);
    expect(resultInfo1.type).toEqual("complete");
    if (resultInfo1.type !== "complete") {
      throw new UnreachableError();
    }
    const phraseInfos1 = [...resultInfo1.phraseInfos.values()];
    expect(phraseInfos1.length).toEqual(3);

    // 2回目のレンダリングで発行された cacheLoaded イベントからフレーズ情報を取得
    const cacheLoadedEventInfos = renderingEventInfos.filter(
      (value) => value.type === "cacheLoaded",
    );
    expect(cacheLoadedEventInfos.length).toEqual(2);
    const phraseInfos2 = [...cacheLoadedEventInfos[1].phraseInfos.values()];
    expect(phraseInfos2.length).toEqual(3);

    // フレーズ情報を開始位置でソート
    phraseInfos1.forEach((value) =>
      expect(value.notes.length).toBeGreaterThanOrEqual(1),
    );
    phraseInfos2.forEach((value) =>
      expect(value.notes.length).toBeGreaterThanOrEqual(1),
    );
    phraseInfos1.sort((a, b) => a.notes[0].position - b.notes[0].position);
    phraseInfos2.sort((a, b) => a.notes[0].position - b.notes[0].position);

    // 1番目と3番目のフレーズは、キャッシュが効いて同一のはず
    expect(phraseInfos1[0]).toEqual(phraseInfos2[0]);
    expect(phraseInfos1[1]).not.toEqual(phraseInfos2[1]);
    expect(phraseInfos1[2]).toEqual(phraseInfos2[2]);
  });

  test("変更された部分（フレーズ）のみ再レンダリングされる", async () => {
    const trackId = TrackId(uuid4());
    const notesArray = [
      createTestNotes(0),
      createTestNotes(1),
      createTestNotes(2),
    ];

    const songTrackRenderer = createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    // 1回目のレンダリング
    const snapshot1 = createSnapshot([
      [
        trackId,
        {
          singer: { engineId, styleId: singerStyleId },
          notes: shiftNotesByOneMeasures(joinNotesWithRest(notesArray)),
        },
      ],
    ]);
    await songTrackRenderer.render(snapshot1);

    // 2番目のフレーズのノーツを変更
    notesArray[1] = createTestNotes(3);

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(toRenderingEventInfo(event));
    });

    // 2回目のレンダリング
    const snapshot2 = createSnapshot([
      [
        trackId,
        {
          singer: { engineId, styleId: singerStyleId },
          notes: shiftNotesByOneMeasures(joinNotesWithRest(notesArray)),
        },
      ],
    ]);
    await songTrackRenderer.render(snapshot2);

    const renderingEventInfos = await Promise.all(renderingEventInfoPromises);

    // 2回目のレンダリングで発行された phraseRenderingStarted イベントと
    // phraseRenderingComplete イベントの数を検証する
    // 変更されたのは1フレーズだけなので、これらのイベントの発行は1回ずつのはず
    const phraseRenderingStartedEventInfos = renderingEventInfos.filter(
      (value) => value.type === "phraseRenderingStarted",
    );
    const phraseRenderingCompleteEventInfos = renderingEventInfos.filter(
      (value) => value.type === "phraseRenderingComplete",
    );
    expect(phraseRenderingStartedEventInfos.length).toEqual(1);
    expect(phraseRenderingCompleteEventInfos.length).toEqual(1);
  });

  test("レンダリングを中断できる", async () => {
    const trackId = TrackId(uuid4());
    const notesArray = [
      createTestNotes(0),
      createTestNotes(1),
      createTestNotes(2),
    ];

    const songTrackRenderer = createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    let volumeGenerationCompleteEventCount = 0;
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(toRenderingEventInfo(event));

      if (event.type === "volumeGenerationComplete") {
        volumeGenerationCompleteEventCount++;
      }
      // 2番目のフレーズのボリューム生成が終わったら中断要求を出す
      if (volumeGenerationCompleteEventCount === 2) {
        songTrackRenderer.interruptRendering();
      }
    });

    const snapshot = createSnapshot([
      [
        trackId,
        {
          singer: { engineId, styleId: singerStyleId },
          notes: shiftNotesByOneMeasures(joinNotesWithRest(notesArray)),
        },
      ],
    ]);
    const result = await songTrackRenderer.render(snapshot);

    const renderingEventInfos = await Promise.all(renderingEventInfoPromises);

    // 結果が interrupted であることを確認
    expect(result.type).toEqual("interrupted");

    // phraseRenderingStarted イベントと phraseRenderingComplete イベントの数を検証する
    // 2フレーズ目まで処理され、3フレーズ目は処理されないはず
    const phraseRenderingStartedEventInfos = renderingEventInfos.filter(
      (value) => value.type === "phraseRenderingStarted",
    );
    const phraseRenderingCompleteEventInfos = renderingEventInfos.filter(
      (value) => value.type === "phraseRenderingComplete",
    );
    expect(phraseRenderingStartedEventInfos.length).toEqual(2);
    expect(phraseRenderingCompleteEventInfos.length).toEqual(2);
  });

  test("クエリの生成でエラーが発生した場合、phraseRenderingError イベントが発行され、次のフレーズのレンダリングに進む", async () => {
    const trackId = TrackId(uuid4());
    const notesArray = [
      createTestNotes(0),
      createTestNotesWithInvalidLyrics(),
      createTestNotes(2),
    ];

    const songTrackRenderer = createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(toRenderingEventInfo(event));
    });

    const snapshot = createSnapshot([
      [
        trackId,
        {
          singer: { engineId, styleId: singerStyleId },
          notes: shiftNotesByOneMeasures(joinNotesWithRest(notesArray)),
        },
      ],
    ]);
    const result = await songTrackRenderer.render(snapshot);

    const renderingEventInfos = await Promise.all(renderingEventInfoPromises);

    // 歌詞のエラーがあってもレンダリング処理は続行されるので、結果は complete になるはず
    expect(result.type).toEqual("complete");

    const normalEventSequence: RenderingEventInfo["type"][] = [
      "phraseRenderingStarted",
      "queryGenerationComplete",
      "pitchGenerationComplete",
      "volumeGenerationComplete",
      "voiceSynthesisComplete",
      "phraseRenderingComplete",
    ];
    const errorEventSequence: RenderingEventInfo["type"][] = [
      "phraseRenderingStarted",
      "phraseRenderingError",
    ];

    // 実際に発行されたイベントのタイプ配列と比較する
    expect(renderingEventInfos.map((value) => value.type)).toEqual([
      "phrasesGenerated",
      "cacheLoaded",
      ...normalEventSequence,
      ...errorEventSequence,
      ...normalEventSequence,
    ]);
  });

  test("トラックにシンガーが割り当てられていない場合、そのトラックのフレーズはレンダリングされない", async () => {
    const trackId1 = TrackId(uuid4());
    const singer1 = undefined;
    const notesArray1 = [
      createTestNotes(0),
      createTestNotes(1),
      createTestNotes(2),
    ];

    const trackId2 = TrackId(uuid4());
    const singer2 = { engineId, styleId: singerStyleId };
    const notesArray2 = [
      createTestNotes(0),
      createTestNotes(3),
      createTestNotes(4),
    ];

    const songTrackRenderer = createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(toRenderingEventInfo(event));
    });

    const snapshot = createSnapshot([
      [
        trackId1,
        {
          singer: singer1,
          notes: shiftNotesByOneMeasures(joinNotesWithRest(notesArray1)),
        },
      ],
      [
        trackId2,
        {
          singer: singer2,
          notes: shiftNotesByOneMeasures(joinNotesWithRest(notesArray2)),
        },
      ],
    ]);
    const result = await songTrackRenderer.render(snapshot);

    const renderingEventInfos = await Promise.all(renderingEventInfoPromises);
    const renderingResultInfo = await toRenderingResultInfo(result);

    expect(renderingResultInfo.type).toEqual("complete");
    if (renderingResultInfo.type !== "complete") {
      throw new UnreachableError();
    }

    // 各トラックの phraseRenderingStarted イベントの数を検証する
    for (const [trackId, track] of snapshot.tracks) {
      const phraseInfos = renderingResultInfo.phraseInfos;
      const phraseRenderingStartedEventInfos = renderingEventInfos.filter(
        (value) =>
          value.type === "phraseRenderingStarted" &&
          getOrThrow(phraseInfos, value.phraseKey).trackId === trackId,
      );
      if (track.singer == undefined) {
        // シンガーが未設定のトラックのフレーズはレンダリングされないはず
        expect(phraseRenderingStartedEventInfos.length).toEqual(0);
      } else {
        // シンガーが設定されているトラックのフレーズはレンダリングされるはず
        expect(phraseRenderingStartedEventInfos.length).toEqual(3);
      }
    }
  });

  test("再生ヘッド位置に近いフレーズから優先的にレンダリングされる", async () => {
    const trackId = TrackId(uuid4());
    const notes = shiftNotesByOneMeasures(
      joinNotesWithRest([
        createTestNotes(0),
        createTestNotes(1),
        createTestNotes(2),
        createTestNotes(3),
        createTestNotes(4),
        createTestNotes(5),
        createTestNotes(6),
      ]),
    );
    const phraseIndexesPointedToByPlayhead = [3, 3, 6, 6, 6, 6, 6];
    const phraseIndexesInExpectedRenderingOrder = [3, 4, 6, 0, 1, 2, 5];
    const phraseRangeInfos = getPhraseRangeInfos(notes);

    let currentIndex = 0;
    const movePlayheadToNextPosition = () => {
      currentIndex++;
    };

    const songTrackRenderer = createSongTrackRendererUsingMock({
      playheadPositionGetter: () => {
        const phraseIndex = phraseIndexesPointedToByPlayhead[currentIndex];
        const phraseRangeInfo = phraseRangeInfos[phraseIndex];
        const phraseStartPos = phraseRangeInfo.startTicks;
        const phraseEndPos = phraseRangeInfo.endTicks;
        const phraseDuration = phraseEndPos - phraseStartPos;
        return Math.floor(phraseStartPos + phraseDuration * 0.5);
      },
    });

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(toRenderingEventInfo(event));

      // フレーズのピッチ生成が完了したら再生ヘッド位置を更新する
      if (event.type === "pitchGenerationComplete") {
        movePlayheadToNextPosition();
      }
    });

    const snapshot = createSnapshot([
      [
        trackId,
        {
          singer: { engineId, styleId: singerStyleId },
          notes,
        },
      ],
    ]);
    const result = await songTrackRenderer.render(snapshot);

    const renderingEventInfos = await Promise.all(renderingEventInfoPromises);
    const renderingResultInfo = await toRenderingResultInfo(result);

    expect(renderingResultInfo.type).toEqual("complete");
    if (renderingResultInfo.type !== "complete") {
      throw new UnreachableError();
    }
    renderingResultInfo.phraseInfos.forEach((value) =>
      expect(value.notes.length).toBeGreaterThanOrEqual(1),
    );

    // 結果のフレーズ情報を開始位置でソートし、PhraseKeyの配列を取得
    const phraseInfosEntries = [...renderingResultInfo.phraseInfos.entries()];
    phraseInfosEntries.sort(
      (a, b) => a[1].notes[0].position - b[1].notes[0].position,
    );
    const sortedPhraseKeys = phraseInfosEntries.map((value) => value[0]);

    // 期待されるレンダリング順序に従って、PhraseKeyを並び変える
    const orderedPhraseKeys = phraseIndexesInExpectedRenderingOrder.map(
      (phraseIndex) => sortedPhraseKeys[phraseIndex],
    );

    // 実際に phraseRenderingStarted が発行された順序と、期待される順序を、
    // フレーズキーを使って比較
    const phraseRenderingStartedEventInfos = renderingEventInfos.filter(
      (value) => value.type === "phraseRenderingStarted",
    );
    expect(
      phraseRenderingStartedEventInfos.map((value) => value.phraseKey),
    ).toEqual(orderedPhraseKeys);
  });
});
