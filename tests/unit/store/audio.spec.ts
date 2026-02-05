import { beforeEach, describe, test, expect } from "vitest";
import { store } from "@/store";
import type { EditorAudioQuery, AudioItem } from "@/store/type";
import { AudioKey, EngineId, SpeakerId, StyleId } from "@/type/preload";
import { uuid4, resetMockMode } from "@/helpers/random";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

function createEmptyEditorAudioQuery(): EditorAudioQuery {
  return {
    accentPhrases: [],
    speedScale: 1,
    pitchScale: 0,
    intonationScale: 1,
    volumeScale: 1,
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.1,
    pauseLengthScale: 1,
    outputSamplingRate: 24000,
    outputStereo: false,
    kana: "",
  };
}

function createEditorAudioQueryWithLength(
  lengthInSeconds: number,
): EditorAudioQuery {
  const query = createEmptyEditorAudioQuery();
  const vowelLength =
    lengthInSeconds - query.prePhonemeLength - query.postPhonemeLength;

  query.accentPhrases = [
    {
      moras: [
        {
          text: "あ",
          vowel: "a",
          vowelLength,
          pitch: 0,
          consonant: undefined,
          consonantLength: undefined,
        },
      ],
      accent: 1,
      pauseMora: undefined,
    },
  ];

  return query;
}

function createAudioItem(query: EditorAudioQuery | undefined): AudioItem {
  return {
    text: "テスト",
    voice: {
      engineId: EngineId("test"),
      speakerId: SpeakerId("test-speaker"),
      styleId: StyleId(0),
    },
    query,
  };
}

const initialState = cloneWithUnwrapProxy(store.state);
beforeEach(() => {
  store.replaceState(cloneWithUnwrapProxy(initialState));

  resetMockMode();
});

describe("TOTAL_AUDIO_LENGTH", () => {
  test("複数の AudioItem の合計時間を計算する", () => {
    const audioKey1 = AudioKey(uuid4());
    const audioKey2 = AudioKey(uuid4());

    const query1 = createEditorAudioQueryWithLength(0.4); // 0.1 + 0.2 + 0.1 = 0.4
    const query2 = createEditorAudioQueryWithLength(0.5); // (0.1 + 0.3 + 0.1) / 2 = 0.25
    query2.speedScale = 2;

    const audioItem1 = createAudioItem(query1);
    const audioItem2 = createAudioItem(query2);

    store.mutations.INSERT_AUDIO_ITEM({
      audioKey: audioKey1,
      audioItem: audioItem1,
      prevAudioKey: undefined,
    });
    store.mutations.INSERT_AUDIO_ITEM({
      audioKey: audioKey2,
      audioItem: audioItem2,
      prevAudioKey: audioKey1,
    });

    const total = store.getters.TOTAL_AUDIO_LENGTH;
    expect(total).toBeCloseTo(0.65);
  });

  test("クエリがない AudioItem は無視する", () => {
    const audioKey1 = AudioKey(uuid4());
    const audioKey2 = AudioKey(uuid4());

    const query1 = createEditorAudioQueryWithLength(0.4); // 0.4

    const audioItem1 = createAudioItem(query1);
    const audioItem2 = createAudioItem(undefined); // query なし

    store.mutations.INSERT_AUDIO_ITEM({
      audioKey: audioKey1,
      audioItem: audioItem1,
      prevAudioKey: undefined,
    });
    store.mutations.INSERT_AUDIO_ITEM({
      audioKey: audioKey2,
      audioItem: audioItem2,
      prevAudioKey: audioKey1,
    });

    const total = store.getters.TOTAL_AUDIO_LENGTH;
    expect(total).toBeCloseTo(0.4);
  });
});
