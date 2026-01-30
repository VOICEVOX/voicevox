import { beforeEach, describe, expect, test } from "vitest";
import { SongTrackRendererTestUtility } from "./utility";
import { RenderingEventInfo } from "./type";
import { resetMockMode, uuid4 } from "@/helpers/random";
import { EngineId, StyleId, TrackId } from "@/type/preload";
import { createDefaultTempo, DEFAULT_TPQN } from "@/sing/domain";
import { UnreachableError } from "@/type/utility";
import { getOrThrow } from "@/helpers/mapHelper";

const constants = {
  tpqn: DEFAULT_TPQN,
  tempos: [createDefaultTempo(0)],
  engineId: EngineId("mock"),
  singingTeacherStyleId: StyleId(0),
  singerStyleId: StyleId(0),
  frameRate: 93.75,
};

const utility = new SongTrackRendererTestUtility(constants);

beforeEach(() => {
  resetMockMode();
});

describe("SongTrackRenderer", () => {
  test("正しいレンダリング結果が返される", async () => {
    const trackId = TrackId(uuid4());
    const trackNotes = utility.toTrackNotes([
      utility.createTestNotes(0),
      utility.createTestNotes(1),
      utility.createTestNotes(2),
    ]);

    const songTrackRenderer = utility.createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    const snapshot = utility.createSnapshotObject([
      [
        trackId,
        {
          singer: {
            engineId: constants.engineId,
            styleId: constants.singerStyleId,
          },
          notes: trackNotes,
        },
      ],
    ]);
    const result = await songTrackRenderer.render(snapshot);

    const renderingResultInfo = await utility.toRenderingResultInfo(result);

    expect({ renderingResultInfo }).toMatchSnapshot();
  });

  test("レンダリングイベントが正しく発行される", async () => {
    const trackId = TrackId(uuid4());
    const trackNotes = utility.toTrackNotes([
      utility.createTestNotes(0),
      utility.createTestNotes(1),
      utility.createTestNotes(2),
    ]);

    const songTrackRenderer = utility.createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(utility.toRenderingEventInfo(event));
    });

    const snapshot = utility.createSnapshotObject([
      [
        trackId,
        {
          singer: {
            engineId: constants.engineId,
            styleId: constants.singerStyleId,
          },
          notes: trackNotes,
        },
      ],
    ]);
    await songTrackRenderer.render(snapshot);

    const renderingEventInfos = await Promise.all(renderingEventInfoPromises);

    expect({ renderingEventInfos }).toMatchSnapshot();
  });

  test("キャッシュがロードされる", async () => {
    const trackId = TrackId(uuid4());
    const phraseNotesArray = [
      utility.createTestNotes(0),
      utility.createTestNotes(1),
      utility.createTestNotes(2),
    ];

    const songTrackRenderer = utility.createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(utility.toRenderingEventInfo(event));
    });

    // 1回目のレンダリング
    const snapshot1 = utility.createSnapshotObject([
      [
        trackId,
        {
          singer: {
            engineId: constants.engineId,
            styleId: constants.singerStyleId,
          },
          notes: utility.toTrackNotes(phraseNotesArray),
        },
      ],
    ]);
    const result1 = await songTrackRenderer.render(snapshot1);

    // 2番目のフレーズのノーツを変更
    phraseNotesArray[1] = utility.createTestNotes(3);

    // 2回目のレンダリング
    const snapshot2 = utility.createSnapshotObject([
      [
        trackId,
        {
          singer: {
            engineId: constants.engineId,
            styleId: constants.singerStyleId,
          },
          notes: utility.toTrackNotes(phraseNotesArray),
        },
      ],
    ]);
    await songTrackRenderer.render(snapshot2);

    const renderingEventInfos = await Promise.all(renderingEventInfoPromises);

    // 1回目のレンダリング結果からフレーズ情報を取得
    const resultInfo1 = await utility.toRenderingResultInfo(result1);
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
    const phraseNotesArray = [
      utility.createTestNotes(0),
      utility.createTestNotes(1),
      utility.createTestNotes(2),
    ];

    const songTrackRenderer = utility.createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    // 1回目のレンダリング
    const snapshot1 = utility.createSnapshotObject([
      [
        trackId,
        {
          singer: {
            engineId: constants.engineId,
            styleId: constants.singerStyleId,
          },
          notes: utility.toTrackNotes(phraseNotesArray),
        },
      ],
    ]);
    await songTrackRenderer.render(snapshot1);

    // 2番目のフレーズのノーツを変更
    phraseNotesArray[1] = utility.createTestNotes(3);

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(utility.toRenderingEventInfo(event));
    });

    // 2回目のレンダリング
    const snapshot2 = utility.createSnapshotObject([
      [
        trackId,
        {
          singer: {
            engineId: constants.engineId,
            styleId: constants.singerStyleId,
          },
          notes: utility.toTrackNotes(phraseNotesArray),
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
    const trackNotes = utility.toTrackNotes([
      utility.createTestNotes(0),
      utility.createTestNotes(1),
      utility.createTestNotes(2),
    ]);

    const songTrackRenderer = utility.createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    let volumeGenerationCompleteEventCount = 0;
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(utility.toRenderingEventInfo(event));

      if (event.type === "volumeGenerationComplete") {
        volumeGenerationCompleteEventCount++;
      }
      // 2番目のフレーズのボリューム生成が終わったら、レンダリングの中断要求を出す
      if (volumeGenerationCompleteEventCount === 2) {
        songTrackRenderer.requestRenderingInterruption();
      }
    });

    const snapshot = utility.createSnapshotObject([
      [
        trackId,
        {
          singer: {
            engineId: constants.engineId,
            styleId: constants.singerStyleId,
          },
          notes: trackNotes,
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
    const trackNotes = utility.toTrackNotes([
      utility.createTestNotes(0),
      utility.createTestNotesWithInvalidLyrics(),
      utility.createTestNotes(2),
    ]);

    const songTrackRenderer = utility.createSongTrackRendererUsingMock({
      playheadPositionGetter: () => 0,
    });

    const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
    songTrackRenderer.addEventListener((event) => {
      renderingEventInfoPromises.push(utility.toRenderingEventInfo(event));
    });

    const snapshot = utility.createSnapshotObject([
      [
        trackId,
        {
          singer: {
            engineId: constants.engineId,
            styleId: constants.singerStyleId,
          },
          notes: trackNotes,
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

  test(
    "トラックにシンガーが割り当てられていない場合、そのトラックのフレーズはレンダリングされない",
    {
      timeout: 10000, // テストが長くなる可能性があるため、タイムアウトを延長
    },
    async () => {
      const trackId1 = TrackId(uuid4());
      const singer1 = undefined;
      const trackNotes1 = utility.toTrackNotes([
        utility.createTestNotes(0),
        utility.createTestNotes(1),
        utility.createTestNotes(2),
      ]);

      const trackId2 = TrackId(uuid4());
      const singer2 = {
        engineId: constants.engineId,
        styleId: constants.singerStyleId,
      };
      const trackNotes2 = utility.toTrackNotes([
        utility.createTestNotes(0),
        utility.createTestNotes(3),
        utility.createTestNotes(4),
      ]);

      const songTrackRenderer = utility.createSongTrackRendererUsingMock({
        playheadPositionGetter: () => 0,
      });

      const renderingEventInfoPromises: Promise<RenderingEventInfo>[] = [];
      songTrackRenderer.addEventListener((event) => {
        renderingEventInfoPromises.push(utility.toRenderingEventInfo(event));
      });

      const snapshot = utility.createSnapshotObject([
        [
          trackId1,
          {
            singer: singer1,
            notes: trackNotes1,
          },
        ],
        [
          trackId2,
          {
            singer: singer2,
            notes: trackNotes2,
          },
        ],
      ]);
      const result = await songTrackRenderer.render(snapshot);

      const renderingEventInfos = await Promise.all(renderingEventInfoPromises);
      const renderingResultInfo = await utility.toRenderingResultInfo(result);

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
    },
  );

  test(
    "再生ヘッド位置に近いフレーズから優先的にレンダリングされる",
    {
      timeout: 10000, // テストが長くなる可能性があるため、タイムアウトを延長
    },
    async () => {
      const trackId = TrackId(uuid4());
      const trackNotes = utility.toTrackNotes([
        utility.createTestNotes(0),
        utility.createTestNotes(1),
        utility.createTestNotes(2),
        utility.createTestNotes(3),
        utility.createTestNotes(4),
        utility.createTestNotes(5),
        utility.createTestNotes(6),
      ]);
      const phraseIndexesPointedToByPlayhead = [3, 3, 6, 6, 6, 6, 6];
      const phraseIndexesInExpectedRenderingOrder = [3, 4, 6, 0, 1, 2, 5];
      const phraseRangeInfos = utility.getPhraseRangeInfos(trackNotes);

      let currentIndex = 0;
      const movePlayheadToNextPosition = () => {
        currentIndex++;
      };

      const songTrackRenderer = utility.createSongTrackRendererUsingMock({
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
        renderingEventInfoPromises.push(utility.toRenderingEventInfo(event));

        // フレーズのピッチ生成が完了したら再生ヘッド位置を更新する
        if (event.type === "pitchGenerationComplete") {
          movePlayheadToNextPosition();
        }
      });

      const snapshot = utility.createSnapshotObject([
        [
          trackId,
          {
            singer: {
              engineId: constants.engineId,
              styleId: constants.singerStyleId,
            },
            notes: trackNotes,
          },
        ],
      ]);
      const result = await songTrackRenderer.render(snapshot);

      const renderingEventInfos = await Promise.all(renderingEventInfoPromises);
      const renderingResultInfo = await utility.toRenderingResultInfo(result);

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
    },
  );
});
