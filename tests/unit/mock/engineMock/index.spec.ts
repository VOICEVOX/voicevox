import { hash } from "../../utils";
import { resetMockMode } from "@/helpers/random";
import { createOpenAPIEngineMock } from "@/mock/engineMock";

beforeEach(() => {
  resetMockMode();
});

describe("createOpenAPIEngineMock", () => {
  const mock = createOpenAPIEngineMock();

  test("versionVersionGet", async () => {
    const response = await mock.versionVersionGet();
    expect(response).toMatchSnapshot();
  });

  test("audioQueryAudioQueryPost", async () => {
    const response = await mock.audioQueryAudioQueryPost({
      text: "こんにちは",
      speaker: 0,
    });
    expect(response).toMatchSnapshot();
  });

  test("synthesisSynthesisPost", async () => {
    const audioQuery = await mock.audioQueryAudioQueryPost({
      text: "こんにちは",
      speaker: 0,
    });
    const response = await mock.synthesisSynthesisPost({
      audioQuery,
      speaker: 0,
    });
    expect(await hash(await response.arrayBuffer())).toMatchSnapshot();
  });

  test("singFrameAudioQuerySingFrameAudioQueryPost", async () => {
    const response = await mock.singFrameAudioQuerySingFrameAudioQueryPost({
      speaker: 0,
      score: {
        notes: [
          { id: "a", key: undefined, frameLength: 10, lyric: "" },
          { id: "b", key: 30, frameLength: 3, lyric: "て" },
          { id: "c", key: 30, frameLength: 3, lyric: "す" },
          { id: "d", key: 40, frameLength: 1, lyric: "と" },
          { id: "e", key: undefined, frameLength: 10, lyric: "" },
        ],
      },
    });
    expect(response).toMatchSnapshot();
  });

  test("frameSynthesisFrameSynthesisPost", async () => {
    const frameAudioQuery =
      await mock.singFrameAudioQuerySingFrameAudioQueryPost({
        speaker: 0,
        score: {
          notes: [
            { id: "a", key: undefined, frameLength: 10, lyric: "" },
            { id: "b", key: 30, frameLength: 3, lyric: "て" },
            { id: "c", key: 30, frameLength: 3, lyric: "す" },
            { id: "d", key: 40, frameLength: 1, lyric: "と" },
            { id: "e", key: undefined, frameLength: 10, lyric: "" },
          ],
        },
      });
    const response = await mock.frameSynthesisFrameSynthesisPost({
      frameAudioQuery,
      speaker: 0,
    });
    expect(await hash(await response.arrayBuffer())).toMatchSnapshot();
  });

  test("辞書系", async () => {
    let response;

    // 単語の追加
    const wordUuid = await mock.addUserDictWordUserDictWordPost({
      surface: "テスト",
      pronunciation: "テストテスト",
      accentType: 1,
    });
    response = await mock.getUserDictWordsUserDictGet();
    expect(response).toMatchSnapshot();

    // 単語の変更
    await mock.rewriteUserDictWordUserDictWordWordUuidPut({
      wordUuid,
      surface: "テスト",
      pronunciation: "テストテストテスト",
      accentType: 1,
    });
    response = await mock.getUserDictWordsUserDictGet();
    expect(response).toMatchSnapshot();

    // 単語の削除
    await mock.deleteUserDictWordUserDictWordWordUuidDelete({ wordUuid });
    response = await mock.getUserDictWordsUserDictGet();
    expect(response).toMatchSnapshot();
  });
});
