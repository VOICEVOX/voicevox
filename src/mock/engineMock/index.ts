import { audioQueryToFrameAudioQueryMock } from "./audioQueryMock";
import { getEngineManifestMock } from "./manifestMock";
import {
  getSingersMock,
  getSpeakerInfoMock,
  getSpeakersMock,
} from "./characterResourceMock";
import { synthesisFrameAudioQueryMock } from "./synthesisMock";
import {
  aquestalkLikeToAccentPhrasesMock,
  replaceLengthMock,
  replacePitchMock,
  textToActtentPhrasesMock,
} from "./talkModelMock";
import {
  notesAndFramePhonemesAndPitchToVolumeMock,
  notesAndFramePhonemesToPitchMock,
  notesToFramePhonemesMock,
} from "./singModelMock";

import { DictMock } from "./dictMock";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
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
  SingerInfoSingerInfoGetRequest,
  SingFrameAudioQuerySingFrameAudioQueryPostRequest,
  SingFrameVolumeSingFrameVolumePostRequest,
  Speaker,
  SpeakerInfo,
  SpeakerInfoSpeakerInfoGetRequest,
  SupportedDevicesInfo,
  SynthesisSynthesisPostRequest,
} from "@/openapi";

/**
 * エンジンのOpenAPIの関数群のモック。
 * 実装されていない関数もある。
 */
export function createOpenAPIEngineMock(): DefaultApiInterface {
  const dictMock = new DictMock();

  const mockApi: Partial<DefaultApiInterface> = {
    async versionVersionGet(): Promise<string> {
      return "mock";
    },

    // メタ情報
    async engineManifestEngineManifestGet(): Promise<EngineManifest> {
      return getEngineManifestMock();
    },

    async supportedDevicesSupportedDevicesGet(): Promise<SupportedDevicesInfo> {
      return { cpu: true, cuda: false, dml: false };
    },

    // キャラクター情報
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
      return getSpeakerInfoMock(payload.speakerUuid);
    },

    async singersSingersGet(): Promise<Speaker[]> {
      return getSingersMock();
    },

    async singerInfoSingerInfoGet(
      paload: SingerInfoSingerInfoGetRequest,
    ): Promise<SpeakerInfo> {
      return getSpeakerInfoMock(paload.speakerUuid);
    },

    // トーク系
    async audioQueryAudioQueryPost(
      payload: AudioQueryAudioQueryPostRequest,
    ): Promise<AudioQuery> {
      const accentPhrases = await textToActtentPhrasesMock(
        dictMock.applyDict(payload.text),
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
        outputSamplingRate: getEngineManifestMock().defaultSamplingRate,
        outputStereo: false,
      };
    },

    async accentPhrasesAccentPhrasesPost(
      payload: AccentPhrasesAccentPhrasesPostRequest,
    ): Promise<AccentPhrase[]> {
      let accentPhrases: AccentPhrase[];
      if (payload.isKana) {
        accentPhrases = await aquestalkLikeToAccentPhrasesMock(
          payload.text,
          payload.speaker,
        );
      } else {
        accentPhrases = await textToActtentPhrasesMock(
          dictMock.applyDict(payload.text),
          payload.speaker,
        );
      }
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
      const buffer = synthesisFrameAudioQueryMock(
        frameAudioQuery,
        payload.speaker,
      );
      return new Blob([buffer], { type: "audio/wav" });
    },

    // ソング系
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
        outputSamplingRate: getEngineManifestMock().defaultSamplingRate,
        outputStereo: false,
      };
    },

    async singFrameVolumeSingFrameVolumePost(
      payload: SingFrameVolumeSingFrameVolumePostRequest,
    ): Promise<Array<number>> {
      const {
        speaker: styleId,
        bodySingFrameVolumeSingFrameVolumePost: { score, frameAudioQuery },
      } = cloneWithUnwrapProxy(payload);

      const volume = notesAndFramePhonemesAndPitchToVolumeMock(
        score.notes,
        frameAudioQuery.phonemes,
        frameAudioQuery.f0,
        styleId,
      );
      return volume;
    },

    async frameSynthesisFrameSynthesisPost(
      payload: FrameSynthesisFrameSynthesisPostRequest,
    ): Promise<Blob> {
      const { speaker: styleId, frameAudioQuery } =
        cloneWithUnwrapProxy(payload);
      const buffer = synthesisFrameAudioQueryMock(frameAudioQuery, styleId);
      return new Blob([buffer], { type: "audio/wav" });
    },

    // 辞書系
    ...dictMock.createDictMockApi(),
  };

  return mockApi satisfies Partial<DefaultApiInterface> as DefaultApiInterface;
}
