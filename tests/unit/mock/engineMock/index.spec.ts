import { hash } from "../../utils";
import { createOpenAPIEngineMock } from "@/mock/engineMock";

describe("createOpenAPIEngineMock", () => {
  const mock = createOpenAPIEngineMock();

  it("versionVersionGet", async () => {
    const response = await mock.versionVersionGet();
    expect(response).toMatchSnapshot();
  });

  it("audioQueryAudioQueryPost", async () => {
    const response = await mock.audioQueryAudioQueryPost({
      text: "こんにちは",
      speaker: 0,
    });
    expect(response).toMatchSnapshot();
  });

  it("synthesisSynthesisPost", async () => {
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

  it("singFrameAudioQuerySingFrameAudioQueryPost", async () => {
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

  it("frameSynthesisFrameSynthesisPost", async () => {
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
});
