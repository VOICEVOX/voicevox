import { store } from "@/store";
import { resetMockMode, uuid4 } from "@/helpers/random";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

const initialState = cloneWithUnwrapProxy(store.state);
beforeEach(() => {
  store.replaceState(initialState);

  resetMockMode();
});

describe("GENERATE_AUDIO_ITEM", () => {
  it("空っぽ", async () => {
    const audioItem = await store.actions.GENERATE_AUDIO_ITEM({});
    expect(audioItem).toMatchSnapshot();
  });
});
