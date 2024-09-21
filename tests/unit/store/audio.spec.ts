import { store } from "@/store";
import { resetMockMode, uuid4 } from "@/helpers/random";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { CharacterInfo, SpeakerId } from "@/type/preload";

const initialState = cloneWithUnwrapProxy(store.state);
beforeEach(() => {
  store.replaceState(initialState);

  resetMockMode();
});

describe("GENERATE_AUDIO_ITEM", () => {
  メモ：ソフトウェアが正しく起動したあとのstateをモックとして用意しておく。speakerUuidとか。
  beforeEach(() => {
    const mockedState = {
      ...initialState,
      // GENERATE_AUDIO_ITEM内のUSER_ORDERED_CHARACTER_INFOSは１つめのspeakerUuidのみ必要
      // FIXME: GENERATE_AUDIO_ITEMのvoiceを必須の引数にすれば不要になる
      userOrderedCharacterInfos: [
        {
          metas: {
            speakerUuid: SpeakerId(uuid4()),
            styles: [
              {
                styleType: "talk",
              },
            ],
          },
        } as CharacterInfo,
      ],
    };
    store.replaceState(mockedState);
  });
  afterEach(() => {
    // ここをどうにかしたい
  });

  it("空っぽ", async () => {
    const audioItem = await store.actions.GENERATE_AUDIO_ITEM({});
    expect(audioItem).toMatchSnapshot();
  });
});
