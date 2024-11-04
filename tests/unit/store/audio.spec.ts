import { initializeStateAsSoftwareStarted, mockSandbox } from "./utils";

import { createStoreWrapper } from "@/store";
import { resetMockMode } from "@/helpers/random";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { proxyStoreCreator } from "@/store/proxy";
import { UnreachableError } from "@/type/utility";
import { OpenAPIMockEngineConnectorFactory } from "@/infrastructures/EngineConnector";

const store = createStoreWrapper({
  proxyStoreDI: proxyStoreCreator(OpenAPIMockEngineConnectorFactory),
});
const initialState = cloneWithUnwrapProxy(store.state);
beforeEach(() => {
  store.replaceState(initialState);

  resetMockMode();
  mockSandbox();
});

describe("GENERATE_AUDIO_ITEM", () => {
  beforeEach(() => {
    initializeStateAsSoftwareStarted(store);
  });

  it("何も指定しない場合は空のAudioItemを作る", async () => {
    const audioItem = await store.actions.GENERATE_AUDIO_ITEM({});
    expect(audioItem).toMatchSnapshot();
  });

  it("テキストを指定するとtextに値が入る", async () => {
    const audioItem = await store.actions.GENERATE_AUDIO_ITEM({
      text: "こんにちは",
    });
    expect(audioItem).toMatchSnapshot();
  });

  it("baseAudioItemを指定するとパラメータを引き継ぐ", async () => {
    const baseAudioItem = await store.actions.GENERATE_AUDIO_ITEM({});
    if (baseAudioItem.query == undefined) throw new UnreachableError();

    baseAudioItem.query.speedScale = 2.0;

    const audioItem = await store.actions.GENERATE_AUDIO_ITEM({
      baseAudioItem,
    });
    expect(audioItem.query?.speedScale).toBe(2.0);
  });
});
