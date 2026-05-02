import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { hash } from "../../utils";
import { resetMockMode } from "@/helpers/random";
import { createOpenAPIEngineMock } from "@/mock/engineMock";
import { createOrGetTokenizer } from "@/mock/engineMock/talkModelMock";

beforeAll(
  async () => {
    // NOTE: ウォームアップのためトークナイザーを事前に生成する
    await createOrGetTokenizer();
  },

  // NOTE: トークナイザーの生成に時間がかかるためタイムアウトを延長する
  60000,
);

beforeEach(() => {
  resetMockMode();
});

describe("createOpenAPIEngineMock", () => {
  const mock = createOpenAPIEngineMock();

  test("version", async () => {
    const response = await mock.version();
    expect(response).toMatchSnapshot();
  });

  test("audioQuery", async () => {
    const response = await mock.audioQuery({
      text: "こんにちは",
      speaker: 0,
    });
    expect(response).toMatchSnapshot();
  });

  test("synthesis", async () => {
    const audioQuery = await mock.audioQuery({
      text: "こんにちは",
      speaker: 0,
    });
    const response = await mock.synthesis({
      audioQuery,
      speaker: 0,
    });
    expect(await hash(await response.arrayBuffer())).toMatchSnapshot();
  });

  test("singFrameAudioQuery", async () => {
    const response = await mock.singFrameAudioQuery({
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

  test("frameSynthesis", async () => {
    const frameAudioQuery = await mock.singFrameAudioQuery({
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
    const response = await mock.frameSynthesis({
      frameAudioQuery,
      speaker: 0,
    });
    expect(await hash(await response.arrayBuffer())).toMatchSnapshot();
  });

  test("辞書系", async () => {
    let response;

    // 単語の追加
    const wordUuid = await mock.addUserDictWord({
      surface: "テスト",
      pronunciation: "テストテスト",
      accentType: 1,
    });
    response = await mock.getUserDictWords();
    expect(response).toMatchSnapshot();

    // 単語の変更
    await mock.rewriteUserDictWord({
      wordUuid,
      surface: "テスト",
      pronunciation: "テストテストテスト",
      accentType: 1,
    });
    response = await mock.getUserDictWords();
    expect(response).toMatchSnapshot();

    // 単語の削除
    await mock.deleteUserDictWord({ wordUuid });
    response = await mock.getUserDictWords();
    expect(response).toMatchSnapshot();
  });
});
