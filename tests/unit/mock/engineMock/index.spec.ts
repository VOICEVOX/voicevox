import { hash } from "../../utils";
import { createOpenAPIEngineMock } from "@/mock/engineMock";

describe("mock", () => {
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
});
