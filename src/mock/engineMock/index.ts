import { builder, IpadicFeatures, Tokenizer } from "kuromoji";
import { audioQueryToFrameAudioQueryMock } from "./audioQueryMock";
import { getEngineManifestMock } from "./manifestMock";
import { getSpeakerInfoMock, getSpeakersMock } from "./speakerResourceMock";
import { synthesisFrameAudioQueryMock } from "./synthesisMock";
import {
  replaceLengthMock,
  replacePitchMock,
  tokensToActtentPhrasesMock,
} from "./talkModelMock";
import {
  notesAndFramePhonemesAndPitchToVolumeMock,
  notesAndFramePhonemesToPitchMock,
  notesToFramePhonemesMock,
} from "./singModelMock";
import { assetsPath, dicPath } from "./constants";

import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { IEngineConnectorFactory } from "@/infrastructures/EngineConnector";
import {
  AccentPhrase,
  AccentPhrasesAccentPhrasesPostRequest,
  AudioQuery,
  AudioQueryAudioQueryPostRequest,
  DefaultApiInterface,
  EngineManifest,
  FrameAudioQuery,
  FrameSynthesisFrameSynthesisPostRequest,
  MoraDataMoraDataPostRequest,
  SingFrameAudioQuerySingFrameAudioQueryPostRequest,
  SingFrameVolumeSingFrameVolumePostRequest,
  Speaker,
  SpeakerInfo,
  SpeakerInfoSpeakerInfoGetRequest,
  SupportedDevicesInfo,
  SynthesisSynthesisPostRequest,
} from "@/openapi";
import { convertToUrlString, EngineUrlParams } from "@/domain/url";

export const mockUrlParams = {
  protocol: "http:",
  hostname: "mock",
  port: "",
  pathname: "",
} satisfies EngineUrlParams;

export function createOpenAPIEngineMock(): IEngineConnectorFactory {
  let mockApi: Partial<DefaultApiInterface> | undefined = undefined;
  return {
    instance: (host: string) => {
      if (host !== convertToUrlString(mockUrlParams)) {
        throw new Error(`Invalid host: ${host}`);
      }

      if (mockApi == undefined) {
        // テキスト形態素解析器
        const tokenizerPromise = new Promise<Tokenizer<IpadicFeatures>>(
          (resolve, reject) => {
            builder({ dicPath }).build(function (
              err: Error,
              tokenizer: Tokenizer<IpadicFeatures>,
            ) {
              if (err) {
                reject(err);
              } else {
                resolve(tokenizer);
              }
            });
          },
        );

        mockApi = {
          async versionVersionGet(): Promise<string> {
            return "mock";
          },

          async engineManifestEngineManifestGet(): Promise<EngineManifest> {
            return getEngineManifestMock();
          },

          async supportedDevicesSupportedDevicesGet(): Promise<SupportedDevicesInfo> {
            return { cpu: true, cuda: false, dml: false };
          },

          async isInitializedSpeakerIsInitializedSpeakerGet(): Promise<boolean> {
            return true;
          },

          async initializeSpeakerInitializeSpeakerPost(): Promise<void> {
            return;
          },

          async speakersSpeakersGet(): Promise<Speaker[]> {
            return getSpeakersMock();
          },

          async speakerInfoSpeakerInfoGet(
            payload: SpeakerInfoSpeakerInfoGetRequest,
          ): Promise<SpeakerInfo> {
            if (payload.resourceFormat != "url")
              throw new Error("resourceFormatはurl以外未対応です");
            return getSpeakerInfoMock(payload.speakerUuid, assetsPath);
          },

          async audioQueryAudioQueryPost(
            payload: AudioQueryAudioQueryPostRequest,
          ): Promise<AudioQuery> {
            const tokenizer = await tokenizerPromise;
            const tokens = tokenizer.tokenize(payload.text);
            const accentPhrases = tokensToActtentPhrasesMock(
              tokens,
              payload.speaker,
            );

            return {
              accentPhrases,
              speedScale: 1.0,
              pitchScale: 0,
              intonationScale: 1.0,
              volumeScale: 1.0,
              prePhonemeLength: 0.1,
              postPhonemeLength: 0.1,
              outputSamplingRate: 8000,
              outputStereo: false,
            };
          },

          async accentPhrasesAccentPhrasesPost(
            payload: AccentPhrasesAccentPhrasesPostRequest,
          ): Promise<AccentPhrase[]> {
            if (payload.isKana == true)
              throw new Error("AquesTalk風記法は未対応です");

            const tokenizer = await tokenizerPromise;
            const tokens = tokenizer.tokenize(payload.text);
            const accentPhrases = tokensToActtentPhrasesMock(
              tokens,
              payload.speaker,
            );
            return accentPhrases;
          },

          async moraDataMoraDataPost(
            payload: MoraDataMoraDataPostRequest,
          ): Promise<AccentPhrase[]> {
            const accentPhrase = cloneWithUnwrapProxy(payload.accentPhrase);
            replaceLengthMock(accentPhrase, payload.speaker);
            replacePitchMock(accentPhrase, payload.speaker);
            return accentPhrase;
          },

          async synthesisSynthesisPost(
            payload: SynthesisSynthesisPostRequest,
          ): Promise<Blob> {
            const frameAudioQuery = audioQueryToFrameAudioQueryMock(
              payload.audioQuery,
              {
                enableInterrogativeUpspeak:
                  payload.enableInterrogativeUpspeak ?? false,
              },
            );
            return synthesisFrameAudioQueryMock(
              frameAudioQuery,
              payload.speaker,
            );
          },

          async singFrameAudioQuerySingFrameAudioQueryPost(
            payload: SingFrameAudioQuerySingFrameAudioQueryPostRequest,
          ): Promise<FrameAudioQuery> {
            const { score, speaker: styleId } = cloneWithUnwrapProxy(payload);

            const phonemes = notesToFramePhonemesMock(score.notes, styleId);
            const f0 = notesAndFramePhonemesToPitchMock(
              score.notes,
              phonemes,
              styleId,
            );
            const volume = notesAndFramePhonemesAndPitchToVolumeMock(
              score.notes,
              phonemes,
              f0,
              styleId,
            );

            return {
              f0,
              volume,
              phonemes,
              volumeScale: 1.0,
              outputSamplingRate: 24000,
              outputStereo: false,
            };
          },

          async singFrameVolumeSingFrameVolumePost(
            payload: SingFrameVolumeSingFrameVolumePostRequest,
          ): Promise<Array<number>> {
            const {
              speaker: stlyeId,
              bodySingFrameVolumeSingFrameVolumePost: {
                score,
                frameAudioQuery,
              },
            } = cloneWithUnwrapProxy(payload);

            const volume = notesAndFramePhonemesAndPitchToVolumeMock(
              score.notes,
              frameAudioQuery.phonemes,
              frameAudioQuery.f0,
              stlyeId,
            );
            return volume;
          },

          async frameSynthesisFrameSynthesisPost(
            payload: FrameSynthesisFrameSynthesisPostRequest,
          ): Promise<Blob> {
            const { speaker: styleId, frameAudioQuery } =
              cloneWithUnwrapProxy(payload);
            return synthesisFrameAudioQueryMock(frameAudioQuery, styleId);
          },
        };
      }

      return mockApi as DefaultApiInterface;
    },
  };
}
