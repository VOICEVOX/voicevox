import {
  AudioItem,
  AudioStoreState,
  EditorAudioQuery,
  FetchAudioResult,
  IEngineConnectorFactoryActionsMapper,
  SettingStoreState,
} from "./type";
import { convertAudioQueryFromEditorToEngine } from "./proxy";
import { generateTempUniqueId } from "./utility";

const audioBlobCache: Record<string, Blob> = {};

type Instance = {
  invoke: IEngineConnectorFactoryActionsMapper;
};

/**
 * エンジンで音声を合成する。音声のキャッシュ機構も備える。
 */
export async function fetchAudioFromAudioItem(
  state: AudioStoreState & SettingStoreState,
  instance: Instance,
  {
    audioItem,
  }: {
    audioItem: AudioItem;
  },
): Promise<FetchAudioResult> {
  console.log("fetchAudioFromAudioItem");
  // 試しにここで弄ってみる
  // audioItem.query.accentPhrases[0].moras[0].consonantLength = 0.1; コンソールには出るがqueryでundefined
  // 多分非同期が悪さしててこの時点ではまだaudioQueryのresponseは入ってない
  const engineId = audioItem.voice.engineId;

  const [id, audioQuery] = await generateUniqueIdAndQuery(state, audioItem);
  await console.log(audioQuery); // preset未反映
  // audioQuery.accentPhrases[0].moras[0].vowelLength = 0.1; // まだ
  if (audioQuery == undefined)
    throw new Error("audioQuery is not defined for audioItem");

  if (Object.prototype.hasOwnProperty.call(audioBlobCache, id)) {
    console.log("check"); // 来てない
    const blob = audioBlobCache[id];
    return { audioQuery, blob };
  }
  // audioQuery.accentPhrases[0].moras[0].vowelLength = 0.1; // 反映確認
  const speaker = audioItem.voice.styleId;
  // audioQuery.accentPhrases[0].moras[0].vowelLength = 0.1; // 反映確認
  // 何かしらの互換のための処理？
  const engineAudioQuery = convertAudioQueryFromEditorToEngine(
    audioQuery,
    state.engineManifests[engineId].defaultSamplingRate,
  );
  // audioQuery.accentPhrases[0].moras[0].vowelLength = 0.1; // 反映確認
  // マニュアル値の設定はどこでやってるんだろ audioQueryの前？
  // console.log(audioQuery);
  await console.log(engineAudioQuery);

  let blob: Blob;
  // FIXME: モーフィングが設定で無効化されていてもモーフィングが行われるので気づけるUIを作成する
  if (audioItem.morphingInfo != undefined) {
    if (!isMorphable(state, { audioItem })) throw new NotMorphableError();
    blob = await instance.invoke("synthesisMorphingSynthesisMorphingPost")({
      audioQuery: engineAudioQuery,
      baseSpeaker: speaker,
      targetSpeaker: audioItem.morphingInfo.targetStyleId,
      morphRate: audioItem.morphingInfo.rate,
    });
  } else {
    blob = await instance.invoke("synthesisSynthesisPost")({
      audioQuery: engineAudioQuery,
      speaker,
      enableInterrogativeUpspeak:
        state.experimentalSetting.enableInterrogativeUpspeak,
    });
  }
  audioBlobCache[id] = blob;
  return { audioQuery, blob };
}

export async function generateLabFromAudioQuery(
  audioQuery: EditorAudioQuery,
  offset?: number,
) {
  console.log("generateLabFromAudioQuery");
  const speedScale = audioQuery.speedScale;

  let labString = "";
  let timestamp = offset ?? 0;

  labString += timestamp.toFixed() + " ";
  timestamp += (audioQuery.prePhonemeLength * 10000000) / speedScale;
  labString += timestamp.toFixed() + " ";
  labString += "pau" + "\n";

  audioQuery.accentPhrases.forEach((accentPhrase) => {
    accentPhrase.moras.forEach((mora) => {
      if (mora.consonantLength != undefined && mora.consonant != undefined) {
        labString += timestamp.toFixed() + " ";
        timestamp += (mora.consonantLength * 10000000) / speedScale;
        labString += timestamp.toFixed() + " ";
        labString += mora.consonant + "\n";
      }
      labString += timestamp.toFixed() + " ";
      timestamp += (mora.vowelLength * 10000000) / speedScale;
      labString += timestamp.toFixed() + " ";
      if (mora.vowel != "N") {
        labString += mora.vowel.toLowerCase() + "\n";
      } else {
        labString += mora.vowel + "\n";
      }
    });
    if (accentPhrase.pauseMora != undefined) {
      labString += timestamp.toFixed() + " ";
      timestamp += (accentPhrase.pauseMora.vowelLength * 10000000) / speedScale;
      labString += timestamp.toFixed() + " ";
      labString += accentPhrase.pauseMora.vowel + "\n";
    }
  });

  labString += timestamp.toFixed() + " ";
  timestamp += (audioQuery.postPhonemeLength * 10000000) / speedScale;
  labString += timestamp.toFixed() + " ";
  labString += "pau" + "\n";

  return labString;
}

async function generateUniqueIdAndQuery(
  state: SettingStoreState,
  audioItem: AudioItem,
): Promise<[string, EditorAudioQuery | undefined]> {
  audioItem = JSON.parse(JSON.stringify(audioItem)) as AudioItem;
  const audioQuery = audioItem.query;
  if (audioQuery != undefined) {
    audioQuery.outputSamplingRate =
      state.engineSettings[audioItem.voice.engineId].outputSamplingRate;
    audioQuery.outputStereo = state.savingSetting.outputStereo;
  }

  const id = await generateTempUniqueId([
    audioItem.text,
    audioQuery,
    audioItem.voice,
    audioItem.morphingInfo,
    state.experimentalSetting.enableInterrogativeUpspeak, // このフラグが違うと、同じAudioQueryで違う音声が生成されるので追加
  ]);
  return [id, audioQuery];
}

export function isMorphable(
  state: AudioStoreState,
  {
    audioItem,
  }: {
    audioItem: AudioItem;
  },
) {
  if (audioItem.morphingInfo?.targetStyleId == undefined) return false;
  const { engineId, styleId } = audioItem.voice;
  const info =
    state.morphableTargetsInfo[engineId]?.[styleId]?.[
      audioItem.morphingInfo.targetStyleId
    ];
  if (info == undefined) return false;
  return info.isMorphable;
}

class NotMorphableError extends Error {
  constructor() {
    super("モーフィングの設定が無効です。");
  }
}

export function handlePossiblyNotMorphableError(e: unknown) {
  if (e instanceof NotMorphableError) {
    return e.message;
  } else {
    window.backend.logError(e);
    return;
  }
}
