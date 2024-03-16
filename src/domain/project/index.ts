/**
 * プロジェクトファイル関連のコード
 */

import semver from "semver";

import { LatestProjectType, projectSchema } from "./schema";
import { AccentPhrase } from "@/openapi";
import { EngineId, StyleId } from "@/type/preload";
import {
  DEFAULT_BEAT_TYPE,
  DEFAULT_BEATS,
  DEFAULT_BPM,
  DEFAULT_TPQN,
} from "@/sing/storeHelper";

const DEFAULT_SAMPLING_RATE = 24000;

const validateTalkProject = (talkProject: LatestProjectType["talk"]) => {
  if (
    !talkProject.audioKeys.every(
      (audioKey) => audioKey in talkProject.audioItems
    )
  ) {
    throw new Error(
      "Every audioKey in audioKeys should be a key of audioItems"
    );
  }
  if (
    !talkProject.audioKeys.every(
      (audioKey) => talkProject.audioItems[audioKey]?.voice != undefined
    )
  ) {
    throw new Error('Every audioItem should have a "voice" attribute.');
  }
  if (
    !talkProject.audioKeys.every(
      (audioKey) =>
        talkProject.audioItems[audioKey]?.voice.engineId != undefined
    )
  ) {
    throw new Error('Every voice should have a "engineId" attribute.');
  }
  // FIXME: assert engineId is registered
  if (
    !talkProject.audioKeys.every(
      (audioKey) =>
        talkProject.audioItems[audioKey]?.voice.speakerId != undefined
    )
  ) {
    throw new Error('Every voice should have a "speakerId" attribute.');
  }
  if (
    !talkProject.audioKeys.every(
      (audioKey) => talkProject.audioItems[audioKey]?.voice.styleId != undefined
    )
  ) {
    throw new Error('Every voice should have a "styleId" attribute.');
  }
};

/**
 * CharacterInfoのうち、マイグレーションに必要な各ID情報だけを抽出した型
 * FIXME: データ構造をCharacterInfoに合わせる必要はないので、もっと扱いやすい型にする
 */
type PartOfCharacterInfo = {
  metas: {
    speakerUuid: string;
    styles: {
      engineId: EngineId;
      styleId: StyleId;
    }[];
  };
};

/**
 * プロジェクトファイルのマイグレーション
 */
export const migrateProjectFileObject = async (
  // FIXME: 下のeslint-disableを使わない方法で書き直す
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projectData: any,
  DI: {
    fetchMoraData: (payload: {
      accentPhrases: AccentPhrase[];
      engineId: EngineId;
      styleId: StyleId;
    }) => Promise<AccentPhrase[]>;
    characterInfos: PartOfCharacterInfo[];
  }
) => {
  const { fetchMoraData, characterInfos } = DI;

  // appVersion Validation check
  if (
    !("appVersion" in projectData && typeof projectData.appVersion === "string")
  ) {
    throw new Error("The appVersion of the project file should be string");
  }
  const projectAppVersion: string = projectData.appVersion;
  if (!semver.valid(projectAppVersion)) {
    throw new Error(
      `The app version of the project file "${projectAppVersion}" is invalid. The app version should be a string in semver format.`
    );
  }

  const semverSatisfiesOptions: semver.Options = {
    includePrerelease: true,
  };

  // Migration
  const engineId = EngineId("074fc39e-678b-4c13-8916-ffca8d505d1d");

  if (semver.satisfies(projectAppVersion, "<0.4", semverSatisfiesOptions)) {
    for (const audioItemsKey in projectData.audioItems) {
      if ("charactorIndex" in projectData.audioItems[audioItemsKey]) {
        projectData.audioItems[audioItemsKey].characterIndex =
          projectData.audioItems[audioItemsKey].charactorIndex;
        delete projectData.audioItems[audioItemsKey].charactorIndex;
      }
    }
    for (const audioItemsKey in projectData.audioItems) {
      if (projectData.audioItems[audioItemsKey].query != null) {
        projectData.audioItems[audioItemsKey].query.volumeScale = 1;
        projectData.audioItems[audioItemsKey].query.prePhonemeLength = 0.1;
        projectData.audioItems[audioItemsKey].query.postPhonemeLength = 0.1;
        projectData.audioItems[audioItemsKey].query.outputSamplingRate =
          DEFAULT_SAMPLING_RATE;
      }
    }
  }

  if (semver.satisfies(projectAppVersion, "<0.5", semverSatisfiesOptions)) {
    for (const audioItemsKey in projectData.audioItems) {
      const audioItem = projectData.audioItems[audioItemsKey];
      if (audioItem.query != null) {
        audioItem.query.outputStereo = false;
        for (const accentPhrase of audioItem.query.accentPhrases) {
          if (accentPhrase.pauseMora) {
            accentPhrase.pauseMora.vowelLength = 0;
          }
          for (const mora of accentPhrase.moras) {
            if (mora.consonant) {
              mora.consonantLength = 0;
            }
            mora.vowelLength = 0;
          }
        }

        // set phoneme length
        // 0.7 未満のプロジェクトファイルは styleId ではなく characterIndex なので、ここだけ characterIndex とした
        if (audioItem.characterIndex == undefined)
          throw new Error("audioItem.characterIndex === undefined");
        await fetchMoraData({
          accentPhrases: audioItem.query.accentPhrases,
          engineId,
          styleId: audioItem.characterIndex,
        }).then((accentPhrases: AccentPhrase[]) => {
          accentPhrases.forEach((newAccentPhrase, i) => {
            const oldAccentPhrase = audioItem.query.accentPhrases[i];
            if (newAccentPhrase.pauseMora) {
              oldAccentPhrase.pauseMora.vowelLength =
                newAccentPhrase.pauseMora.vowelLength;
            }
            newAccentPhrase.moras.forEach((mora, j) => {
              if (mora.consonant) {
                oldAccentPhrase.moras[j].consonantLength = mora.consonantLength;
              }
              oldAccentPhrase.moras[j].vowelLength = mora.vowelLength;
            });
          });
        });
      }
    }
  }

  if (semver.satisfies(projectAppVersion, "<0.7", semverSatisfiesOptions)) {
    for (const audioItemsKey in projectData.audioItems) {
      const audioItem = projectData.audioItems[audioItemsKey];
      if (audioItem.characterIndex != null) {
        if (audioItem.characterIndex == 0) {
          // 四国めたん 0 -> 四国めたん（あまあま） 0
          audioItem.speaker = 0;
        }
        if (audioItem.characterIndex == 1) {
          // ずんだもん 1 -> ずんだもん（あまあま） 1
          audioItem.speaker = 1;
        }
        delete audioItem.characterIndex;
      }
    }
  }

  if (semver.satisfies(projectAppVersion, "<0.8", semverSatisfiesOptions)) {
    for (const audioItemsKey in projectData.audioItems) {
      const audioItem = projectData.audioItems[audioItemsKey];
      if (audioItem.speaker != null) {
        audioItem.styleId = audioItem.speaker;
        delete audioItem.speaker;
      }
    }
  }

  if (semver.satisfies(projectAppVersion, "<0.14", semverSatisfiesOptions)) {
    for (const audioItemsKey in projectData.audioItems) {
      const audioItem = projectData.audioItems[audioItemsKey];
      if (audioItem.engineId == undefined) {
        audioItem.engineId = engineId;
      }
    }
  }

  if (semver.satisfies(projectAppVersion, "<0.15", semverSatisfiesOptions)) {
    for (const audioItemsKey in projectData.audioItems) {
      const audioItem = projectData.audioItems[audioItemsKey];
      if (audioItem.voice == undefined) {
        const oldEngineId = audioItem.engineId;
        const oldStyleId = audioItem.styleId;
        const chracterinfo = characterInfos.find((characterInfo) =>
          characterInfo.metas.styles.some(
            (styeleinfo) =>
              styeleinfo.engineId === audioItem.engineId &&
              styeleinfo.styleId === audioItem.styleId
          )
        );
        if (chracterinfo == undefined)
          throw new Error(
            `chracterinfo == undefined: ${oldEngineId}, ${oldStyleId}`
          );
        const speakerId = chracterinfo.metas.speakerUuid;
        audioItem.voice = {
          engineId: oldEngineId,
          speakerId,
          styleId: oldStyleId,
        };

        delete audioItem.engineId;
        delete audioItem.styleId;
      }
    }
  }

  if (semver.satisfies(projectAppVersion, "<0.17", semverSatisfiesOptions)) {
    // 0.17 未満のプロジェクトファイルはトークの情報のみ
    // なので全情報(audioKeys/audioItems)をtalkに移動する
    projectData.talk = {
      audioKeys: projectData.audioKeys,
      audioItems: projectData.audioItems,
    };

    // ソングの情報を初期化
    // generateSingingStoreInitialScoreが今後変わることがあるかもしれないので、
    // 0.17時点のスコア情報を直接書く
    projectData.song = {
      tpqn: DEFAULT_TPQN,
      tempos: [
        {
          position: 0,
          bpm: DEFAULT_BPM,
        },
      ],
      timeSignatures: [
        {
          measureNumber: 1,
          beats: DEFAULT_BEATS,
          beatType: DEFAULT_BEAT_TYPE,
        },
      ],
      tracks: [
        {
          singer: undefined,
          keyRangeAdjustment: 0,
          notes: [],
        },
      ],
    };

    delete projectData.audioKeys;
    delete projectData.audioItems;
  }

  if (semver.satisfies(projectAppVersion, "<0.17.1", semverSatisfiesOptions)) {
    // volumeRangeAdjustmentの追加
    for (const track of projectData.song.tracks) {
      track.volumeRangeAdjustment = 0;
    }
  }

  // Validation check
  // トークはvalidateTalkProjectで検証する
  // ソングはSET_SCOREの中の`isValidScore`関数で検証される
  const parsedProjectData = projectSchema.parse(projectData);
  validateTalkProject(parsedProjectData.talk);

  return parsedProjectData;
};