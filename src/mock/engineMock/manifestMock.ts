/**
 * エンジンマニフェストのモック。
 */

import { EngineManifest } from "@/openapi";

/** エンジンマニフェストを返すモック */
export function getEngineManifestMock() {
  return {
    manifestVersion: "0.13.1",
    name: "DUMMY Engine",
    brandName: "DUMMY",
    uuid: "c7b58856-bd56-4aa1-afb7-b8415f824b06",
    url: "not_found",
    icon: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjWHpl7X8AB24DJsTeKbEAAAAASUVORK5CYII=", // 1pxの画像
    defaultSamplingRate: 24000,
    frameRate: 93.75,
    termsOfService: "not_found",
    updateInfos: [],
    dependencyLicenses: [],
    supportedVvlibManifestVersion: undefined,
    supportedFeatures: {
      adjustMoraPitch: true,
      adjustPhonemeLength: true,
      adjustSpeedScale: true,
      adjustPitchScale: true,
      adjustIntonationScale: true,
      adjustVolumeScale: true,
      interrogativeUpspeak: false,
      synthesisMorphing: false,
      sing: true,
      manageLibrary: false,
      returnResourceUrl: true,
    },
  } satisfies EngineManifest;
}
