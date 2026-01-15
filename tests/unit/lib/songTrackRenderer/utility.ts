import { hash } from "../../utils";
import {
  PhraseInfo,
  PhraseRangeInfo,
  RenderingEventInfo,
  RenderingResultInfo,
} from "./type";
import { uuid4 } from "@/helpers/random";
import { createOpenAPIEngineMock } from "@/mock/engineMock";
import {
  PhraseForRender,
  SongTrackRenderer,
  SongTrackRenderingEvent,
  SongTrackRenderingResult,
} from "@/sing/songTrackRendering";
import { getOverlappingNoteIds } from "@/sing/storeHelper";
import { calculateHash, getLast } from "@/sing/utility";
import { PhraseKey, SingingVoice } from "@/store/type";
import { EngineId, NoteId, StyleId, TrackId } from "@/type/preload";
import { ExhaustiveError } from "@/type/utility";
import { getOrThrow } from "@/helpers/mapHelper";
import { createDefaultTrack } from "@/sing/domain";
import type { Note, Singer, Tempo, Track } from "@/domain/project/type";

/**
 * SongTrackRenderer のテスト用のユーティリティー。
 */
export class SongTrackRendererTestUtility {
  private readonly tpqn: number;
  private readonly tempos: Tempo[];
  private readonly engineId: EngineId;
  private readonly singingTeacherStyleId: StyleId;
  private readonly frameRate: number;

  constructor(constants: {
    tpqn: number;
    tempos: Tempo[];
    engineId: EngineId;
    singingTeacherStyleId: StyleId;
    frameRate: number;
  }) {
    this.tpqn = constants.tpqn;
    this.tempos = constants.tempos;
    this.engineId = constants.engineId;
    this.singingTeacherStyleId = constants.singingTeacherStyleId;
    this.frameRate = constants.frameRate;
  }

  /**
   * モックエンジンAPIを使用して SongTrackRenderer のインスタンスを生成する。
   *
   * @param playheadPositionGetter 再生ヘッド位置を取得する関数。
   * @returns SongTrackRenderer のインスタンス。
   */
  createSongTrackRendererUsingMock({
    playheadPositionGetter,
  }: {
    playheadPositionGetter: () => number;
  }) {
    const mock = createOpenAPIEngineMock();

    const songTrackRenderer = new SongTrackRenderer({
      config: {
        singingTeacherStyleId: this.singingTeacherStyleId,
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
          return { ...query, frameRate: this.frameRate };
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
  }

  /**
   * テスト用のスナップショットオブジェクトを生成する。
   *
   * @param trackEntries トラックIDとトラック情報（シンガー、ノーツ）のエントリー配列。
   * @returns スナップショットオブジェクト。
   */
  createSnapshotObject(
    trackEntries: [TrackId, { singer?: Singer; notes: Note[] }][],
  ) {
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
      tpqn: this.tpqn,
      tempos: this.tempos,
      tracks,
      trackOverlappingNoteIds,
      engineFrameRates: new Map([[this.engineId, this.frameRate]]),
      editorFrameRate: this.frameRate,
    };
  }

  /**
   * SingingVoiceオブジェクトからハッシュ値を計算する。
   *
   * @param singingVoice 歌声オブジェクト。
   * @returns ハッシュ値のPromise。
   */
  async calculateSingingVoiceHash(singingVoice: SingingVoice) {
    return await hash(await singingVoice.arrayBuffer());
  }

  /**
   * PhraseForRender オブジェクトをテスト検証用の PhraseInfo オブジェクトに変換する。
   * 各レンダリング成果物のハッシュ値も計算して含める。
   *
   * @param phrase PhraseForRender オブジェクト。
   * @returns PhraseInfo オブジェクトのPromise。
   */
  async toPhraseInfo(phrase: PhraseForRender): Promise<PhraseInfo> {
    return {
      notes: phrase.notes,
      startTime: phrase.startTime,
      trackId: phrase.trackId,
      queryKey: phrase.queryKey,
      queryHash:
        phrase.query != undefined
          ? await calculateHash(phrase.query)
          : undefined,
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
          ? await this.calculateSingingVoiceHash(phrase.singingVoice)
          : undefined,
    };
  }

  /**
   * PhraseForRender の Map を PhraseInfo の Map に変換する。
   *
   * @param phrases PhraseForRender の Map。
   * @returns PhraseInfo の Map のPromise。
   */
  async toPhraseInfos(phrases: Map<PhraseKey, PhraseForRender>) {
    const phraseInfos = new Map<PhraseKey, PhraseInfo>();
    for (const [phraseKey, phrase] of phrases) {
      phraseInfos.set(phraseKey, await this.toPhraseInfo(phrase));
    }
    return phraseInfos;
  }

  /**
   * SongTrackRenderingEvent をテスト検証用の RenderingEventInfo に変換する。
   * イベントの種類に応じて、関連データのハッシュ値などを計算して含める。
   *
   * @param event SongTrackRenderingEvent。
   * @returns RenderingEventInfo のPromise。
   */
  async toRenderingEventInfo(
    event: SongTrackRenderingEvent,
  ): Promise<RenderingEventInfo> {
    switch (event.type) {
      case "phrasesGenerated":
        return {
          type: event.type,
          phraseInfos: await this.toPhraseInfos(event.phrases),
        };
      case "cacheLoaded":
        return {
          type: event.type,
          phraseInfos: await this.toPhraseInfos(event.phrases),
        };
      case "phraseRenderingStarted":
        return event;
      case "queryGenerationComplete":
        return {
          type: event.type,
          phraseKey: event.phraseKey,
          queryKey: event.queryKey,
          queryHash: await calculateHash(event.query),
        };
      case "pitchGenerationComplete":
        return {
          type: event.type,
          phraseKey: event.phraseKey,
          singingPitchKey: event.singingPitchKey,
          singingPitchHash: await calculateHash(event.singingPitch),
        };
      case "volumeGenerationComplete":
        return {
          type: event.type,
          phraseKey: event.phraseKey,
          singingVolumeKey: event.singingVolumeKey,
          singingVolumeHash: await calculateHash(event.singingVolume),
        };
      case "voiceSynthesisComplete":
        return {
          type: event.type,
          phraseKey: event.phraseKey,
          singingVoiceKey: event.singingVoiceKey,
          singingVoiceHash: await this.calculateSingingVoiceHash(
            event.singingVoice,
          ),
        };
      case "phraseRenderingComplete":
        return {
          type: event.type,
          phraseKey: event.phraseKey,
          phraseInfo: await this.toPhraseInfo(event.phrase),
        };
      case "phraseRenderingError":
        return event;
      default:
        throw new ExhaustiveError(event);
    }
  }

  /**
   * SongTrackRenderingResult をテスト検証用の RenderingResultInfo に変換する。
   *
   * @param result SongTrackRenderingResult。
   * @returns RenderingResultInfo のPromise。
   */
  async toRenderingResultInfo(
    result: SongTrackRenderingResult,
  ): Promise<RenderingResultInfo> {
    if (result.type === "complete") {
      return {
        type: result.type,
        phraseInfos: await this.toPhraseInfos(result.phrases),
      };
    } else if (result.type === "interrupted") {
      return result;
    } else {
      throw new ExhaustiveError(result);
    }
  }

  /**
   * 指定されたパターン番号に基づいてテスト用のノーツを生成する。
   *
   * @param patternNumber ノートパターンの番号。
   * @returns ノーツ。
   */
  createTestNotes(patternNumber: number) {
    const quarterNoteDuration = this.tpqn;

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
    if (pattern.lyrics.length !== pattern.noteNumbers.length) {
      throw new Error("The number of noteNumbers and lyrics does not match.");
    }

    const notes: Note[] = [];

    for (let i = 0; i < pattern.lyrics.length; i++) {
      notes.push({
        id: NoteId(uuid4()),
        position: quarterNoteDuration * i,
        duration: quarterNoteDuration,
        noteNumber: pattern.noteNumbers[i],
        lyric: pattern.lyrics[i],
      });
    }

    return notes;
  }

  /**
   * 不正な歌詞（クエリの生成でエラーになる歌詞）を持つテスト用ノーツを生成する。
   *
   * @returns ノーツ。
   */
  createTestNotesWithInvalidLyrics(): Note[] {
    const quarterNoteDuration = this.tpqn;

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
  }

  /**
   * ノートの終了位置（Tick）を取得する。
   *
   * @param note 対象のノート。
   * @returns ノートの終了位置。
   */
  getNoteEndPos(note: Note) {
    return note.position + note.duration;
  }

  /**
   * フレーズのノーツの配列をトラックのノーツに変換する。
   *
   * @param phraseNotesArray フレーズのノーツの配列。
   * @returns トラックのノーツ。
   */
  toTrackNotes(phraseNotesArray: Note[][]) {
    const quarterNoteDuration = this.tpqn;
    const oneMeasureDuration = this.tpqn * 4;

    let trackNotes: Note[] = [];
    let position = 0;

    // 間に休符を挟んで連結する
    for (const phraseNotes of phraseNotesArray) {
      for (const note of phraseNotes) {
        trackNotes.push({ ...note, position: position + note.position });
      }

      const lastNote = getLast(trackNotes);
      const lastNoteEndPos = this.getNoteEndPos(lastNote);

      position = lastNoteEndPos + quarterNoteDuration;
    }

    // ノーツ全体を1小節分後ろにシフトする
    trackNotes = trackNotes.map((note) => ({
      ...note,
      position: note.position + oneMeasureDuration,
    }));

    return trackNotes;
  }

  /**
   * トラックのノーツをフレーズのノーツの配列に変換する。
   *
   * @param trackNotes トラックのノーツ。
   * @returns フレーズのノーツの配列。
   */
  toPhraseNotesArray(trackNotes: Note[]) {
    const phraseNotesArray: Note[][] = [];

    for (let i = 0; i < trackNotes.length; i++) {
      const note = trackNotes[i];

      if (i === 0 || this.getNoteEndPos(trackNotes[i - 1]) < note.position) {
        phraseNotesArray.push([note]);
      } else {
        getLast(phraseNotesArray).push(note);
      }
    }

    return phraseNotesArray;
  }

  /**
   * ノーツから各フレーズの範囲情報（開始・終了Tick）を取得する。
   *
   * @param notes 対象のノーツ。
   * @returns フレーズ範囲情報の配列。
   */
  getPhraseRangeInfos(notes: Note[]): PhraseRangeInfo[] {
    const phraseNotesArray = this.toPhraseNotesArray(notes);

    return phraseNotesArray.map((notes) => ({
      startTicks: notes[0].position,
      endTicks: this.getNoteEndPos(getLast(notes)),
    }));
  }
}
