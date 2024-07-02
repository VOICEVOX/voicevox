import kuromoji, { IpadicFeatures, Tokenizer } from "kuromoji";
import { getEngineManifestMock } from "./manifestMock";
import {
  replaseLengthMock,
  replasePitchMock,
  tokensToActtentPhrasesMock,
} from "./talkModelMock";
import { getSpeakerInfoMock, getSpeakersMock } from "./speakerResourceMock";
import { IEngineConnectorFactory } from "@/infrastructures/EngineConnector";
import {
  AccentPhrase,
  AccentPhrasesAccentPhrasesPostRequest,
  AudioQuery,
  AudioQueryAudioQueryPostRequest,
  DefaultApiInterface,
  EngineManifest,
  MoraDataMoraDataPostRequest,
  Speaker,
  SpeakerInfo,
  SpeakerInfoSpeakerInfoGetRequest,
  SupportedDevicesInfo,
} from "@/openapi";

export const dicPath = "engineMock/dict";
export const assetsPath = "engineMock/assets";

export const mockHost = "mock";

export function createOpenAPIEngineMock(): IEngineConnectorFactory {
  let mockApi: Partial<DefaultApiInterface> | undefined = undefined;
  return {
    instance: (host: string) => {
      if (host !== mockHost) {
        throw new Error(`Invalid host: ${host}`);
      }

      if (mockApi == undefined) {
        // テキスト形態素解析器
        const tokenizerPromise = new Promise<Tokenizer<IpadicFeatures>>(
          (resolve, reject) => {
            kuromoji
              .builder({
                dicPath,
              })
              .build(function (err, tokenizer) {
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
              outputSamplingRate: 24000,
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
            replaseLengthMock(payload.accentPhrase, payload.speaker);
            replasePitchMock(payload.accentPhrase, payload.speaker);
            return payload.accentPhrase;
          },
        };
      }

      return mockApi as DefaultApiInterface;
    },
  };
}
