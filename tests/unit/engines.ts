import { State } from "@/store/type";
import dummyImage from "./dummyImage";

export const engineAUuid = "6403c196-4d7a-4f4a-aa02-a4cf75848e72";
export const engineBUuid = "4b15fe97-0b55-4485-80e3-b8d30e99c22d";

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
          speakerUuid: "7ffcb7ce-00ec-4bdc-82cd-45a8889e43ff",
          speakerName: "CV1",
          styles: [
            {
              styleName: "ノーマル",
              styleId: 0,
              engineId: "",
              iconPath: dummyImage,

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
  engineIds: [engineAUuid, engineBUuid],

  engineStates: {
    [engineAUuid]: "STARTING",
    [engineBUuid]: "STARTING",
  },
  engineInfos: {
    [engineAUuid]: {
      uuid: engineAUuid,
      name: "Engine 1",
      executionEnabled: false,
      executionFilePath: "",
      executionArgs: [],
      host: "http://localhost:50021",
      type: "default",
    },
    [engineBUuid]: {
      uuid: engineBUuid,
      name: "Engine 2",
      executionEnabled: false,
      executionFilePath: "",
      executionArgs: [],
      host: "http://localhost:50022",
      type: "vvpp",
    },
  },
  engineManifests: {
    [engineAUuid]: {
      manifestVersion: "0.13.0",
      name: "Engine 1",
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

    [engineBUuid]: {
      manifestVersion: "0.13.0",
      name: "Engine 2",
      uuid: engineBUuid,
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
          speakerUuid: "7ffcb7ce-00ec-4bdc-82cd-45a8889e43ff",
          speakerName: "CV1",
          styles: [
            {
              styleName: "ノーマル",
              styleId: 0,
              engineId: engineAUuid,
              iconPath: dummyImage,

              voiceSamplePaths: [],
            },
          ],
          policy: "CV1の利用規約",
        },
        portraitPath: dummyImage,
      },
    ],

    [engineBUuid]: [
      {
        metas: {
          speakerUuid: "fbffabe4-a3ad-4c6f-831e-fa6a0fb84e8c",
          speakerName: "CV2",
          styles: [
            {
              styleName: "ノーマル",
              styleId: 0,
              engineId: engineBUuid,
              iconPath: dummyImage,

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
