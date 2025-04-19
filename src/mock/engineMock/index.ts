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
  AccentPhrasesRequest,
  AudioQuery,
  AudioQueryRequest,
  DefaultApiInterface,
  EngineManifest,
  FrameAudioQuery,
  FrameSynthesisRequest,
  MoraDataRequest,
  SingerInfoRequest,
  SingFrameAudioQueryRequest,
  SingFrameVolumeRequest,
  Speaker,
  SpeakerInfo,
  SpeakerInfoRequest,
  SupportedDevicesInfo,
  SynthesisRequest,
} from "@/openapi";

/**
 * エンジンのOpenAPIの関数群のモック。
 * 実装されていない関数もある。
 */
export function createOpenAPIEngineMock(): DefaultApiInterface {
  const dictMock = new DictMock();

  const mockApi: Partial<DefaultApiInterface> = {
    async version(): Promise<string> {
      return "mock";
    },

    // メタ情報
    async engineManifest(): Promise<EngineManifest> {
      return getEngineManifestMock();
    },

    async supportedDevices(): Promise<SupportedDevicesInfo> {
      return { cpu: true, cuda: false, dml: false };
    },

    // キャラクター情報
    async isInitializedSpeaker(): Promise<boolean> {
      return true;
    },

    async initializeSpeaker(): Promise<void> {
      return;
    },

    async speakers(): Promise<Speaker[]> {
      return getSpeakersMock();
    },

    async speakerInfo(payload: SpeakerInfoRequest): Promise<SpeakerInfo> {
      return getSpeakerInfoMock(payload.speakerUuid);
    },

    async singers(): Promise<Speaker[]> {
      return getSingersMock();
    },

    async singerInfo(payload: SingerInfoRequest): Promise<SpeakerInfo> {
      return getSpeakerInfoMock(payload.speakerUuid);
    },

    // トーク系
    async audioQuery(payload: AudioQueryRequest): Promise<AudioQuery> {
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
        pauseLength: null,
        pauseLengthScale: 1.0,
        outputSamplingRate: getEngineManifestMock().defaultSamplingRate,
        outputStereo: false,
      };
    },

    async accentPhrases(
      payload: AccentPhrasesRequest,
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

    async moraData(payload: MoraDataRequest): Promise<AccentPhrase[]> {
      const accentPhrase = cloneWithUnwrapProxy(payload.accentPhrase);
      replaceLengthMock(accentPhrase, payload.speaker);
      replacePitchMock(accentPhrase, payload.speaker);
      return accentPhrase;
    },

    async synthesis(payload: SynthesisRequest): Promise<Blob> {
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
    async singFrameAudioQuery(
      payload: SingFrameAudioQueryRequest,
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

    async singFrameVolume(
      payload: SingFrameVolumeRequest,
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

    async frameSynthesis(payload: FrameSynthesisRequest): Promise<Blob> {
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
