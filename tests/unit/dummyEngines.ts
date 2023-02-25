import dummyImage from "./dummyImage";
import { State } from "@/store/type";
import { EngineId, SpeakerId, StyleId } from "@/type/preload";

export const engineAUuid = EngineId("6403c196-4d7a-4f4a-aa02-a4cf75848e72");
export const engineBUuid = EngineId("4b15fe97-0b55-4485-80e3-b8d30e99c22d");

export const singleEngineState: Pick<
  State,
  | "engineIds"
  | "engineStates"
  | "engineInfos"
  | "engineManifests"
  | "characterInfos"
> = {
  engineIds: [engineAUuid],

  engineStates: {
    [engineAUuid]: "STARTING",
  },
  engineInfos: {
    [engineAUuid]: {
      uuid: engineAUuid,
      name: "Engine 1",
      executionEnabled: false,
      executionFilePath: "",
      executionArgs: [],
      host: "http://127.0.0.1",
      type: "default",
    },
  },
  engineManifests: {
    [engineAUuid]: {
      manifestVersion: "0.13.0",
      name: "Engine 1",
      brandName: "Engine 1",
      uuid: engineAUuid,
      url: "https://github.com/VOICEVOX/voicevox_engine",
      icon: "engine_manifest_assets/icon.png",
      defaultSamplingRate: 24000,
      termsOfService: "engine_manifest_assets/terms_of_service.md",
      updateInfos: [],
      dependencyLicenses: [],
      supportedFeatures: {
        adjustMoraPitch: true,
        adjustPhonemeLength: true,
        adjustSpeedScale: true,
        adjustPitchScale: true,
        adjustIntonationScale: true,
        adjustVolumeScale: true,
        interrogativeUpspeak: true,
        synthesisMorphing: true,
      },
    },
  },
  characterInfos: {
    [engineAUuid]: [
      {
        metas: {
          speakerUuid: SpeakerId("7ffcb7ce-00ec-4bdc-82cd-45a8889e43ff"),
          speakerName: "CV1",
          styles: [
            {
              styleName: "ノーマル",
              styleId: StyleId(0),
              engineId: engineAUuid,
              iconPath: dummyImage,
              portraitPath: undefined,

              voiceSamplePaths: [],
            },
          ],
          policy: "CV1の利用規約",
        },
        portraitPath: dummyImage,
      },
    ],
  },
};

export const multipleEngineState: Pick<
  State,
  | "engineIds"
  | "engineStates"
  | "engineInfos"
  | "engineManifests"
  | "characterInfos"
> = {
  engineIds: [...singleEngineState.engineIds, engineBUuid],

  engineStates: {
    ...singleEngineState.engineStates,
    [engineBUuid]: "STARTING",
  },

  engineInfos: {
    ...singleEngineState.engineInfos,
    [engineBUuid]: {
      ...singleEngineState.engineInfos[engineAUuid],
      uuid: engineBUuid,
      name: "Engine 2",
    },
  },

  engineManifests: {
    ...singleEngineState.engineManifests,
    [engineBUuid]: {
      ...singleEngineState.engineManifests[engineAUuid],
      uuid: engineBUuid,
      name: "Engine 2",
      brandName: "Engine 2",
    },
  },

  characterInfos: {
    ...singleEngineState.characterInfos,
    [engineBUuid]: [
      {
        metas: {
          speakerUuid: SpeakerId("b88fdd17-9a10-415d-b8d6-041bebf5c46d"),
          speakerName: "CV2",
          styles: [
            {
              styleName: "ノーマル",
              styleId: StyleId(0),
              engineId: engineBUuid,
              iconPath: dummyImage,
              portraitPath: undefined,
              voiceSamplePaths: [],
            },
          ],
          policy: "CV2の利用規約",
        },
        portraitPath: dummyImage,
      },
    ],
  },
};
