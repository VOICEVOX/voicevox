import { getEngineManifestMock } from "@/mock/engineMock/manifestMock";
import { AllActions, AllGetters, AllMutations, State } from "@/store/type";
import { Store } from "@/store/vuex";
import {
  CharacterInfo,
  DefaultStyleId,
  EngineId,
  EngineInfo,
  SpeakerId,
  StyleId,
} from "@/type/preload";
import { mockUrlParams } from "@/infrastructures/EngineConnector";
import {
  getCharacterInfoMock,
  getCharactersMock,
} from "@/mock/engineMock/characterResourceMock";
import { SandboxKey, Sandbox } from "@/type/preload";

/** バックエンド向けAPIにmockを差し込む */
export function mockSandbox() {
  const sandbox = {
    logError(...params: unknown[]) {
      console.error(...params);
    },
    logWarn(...params: unknown[]) {
      console.warn(...params);
    },
    logInfo(...params: unknown[]) {
      console.info(...params);
    },
  } satisfies Partial<Sandbox>;
  // @ts-expect-error readonlyになっているがmockのため問題ない
  window[SandboxKey] = sandbox;
}

/** ソフトウェアが正しく起動した場合のようにVuex.stateを初期化する */
export async function initializeStateAsSoftwareStarted(
  store: Store<State, AllGetters, AllActions, AllMutations>,
) {
  // エンジンの情報
  const engineManifest = getEngineManifestMock();
  const engineId = EngineId(engineManifest.uuid);
  const { port, ...rest } = mockUrlParams;
  const engineUrlParams = { ...rest, defaultPort: port };
  const engineInfo: EngineInfo = {
    uuid: engineId,
    ...engineUrlParams,
    name: engineManifest.name,
    path: undefined,
    executionEnabled: false,
    executionFilePath: "not_found",
    executionArgs: [],
    isDefault: true,
    type: "path",
  };
  store.commit("SET_ENGINE_INFOS", {
    engineIds: [engineId],
    engineInfos: [engineInfo],
  });
  store.commit("SET_ENGINE_MANIFESTS", {
    engineManifests: { [engineId]: engineManifest },
  });
  store.commit("SET_ENGINE_SETTING", {
    engineId,
    engineSetting: {
      outputSamplingRate: engineManifest.defaultSamplingRate,
      useGpu: false,
    },
  });
  store.commit("SET_ENGINE_STATE", { engineId, engineState: "READY" });

  // キャラクター情報
  const characters = getCharactersMock();
  const characterInfos: CharacterInfo[] = await Promise.all(
    characters.map(async (speaker) => {
      const speakerInfo = await getCharacterInfoMock(speaker.speakerUuid);
      return {
        portraitPath: speakerInfo.portrait,
        metas: {
          speakerUuid: SpeakerId(speaker.speakerUuid),
          speakerName: speaker.name,
          styles: speakerInfo.styleInfos.map((styleInfo) => {
            const style = speaker.styles.find((s) => s.id === styleInfo.id);
            if (style == undefined)
              throw new Error(`style not found: id ${styleInfo.id}`);
            return {
              styleName: style.name,
              styleId: StyleId(style.id),
              styleType: style.type,
              iconPath: styleInfo.icon,
              portraitPath: styleInfo.portrait ?? speakerInfo.portrait,
              engineId,
              voiceSamplePaths: styleInfo.voiceSamples,
            };
          }),
          policy: speakerInfo.policy,
        },
      };
    }),
  );
  store.commit("SET_CHARACTER_INFOS", { engineId, characterInfos });

  // キャラクターの表示順
  store.commit("SET_USER_CHARACTER_ORDER", {
    userCharacterOrder: store.state.characterInfos[engineId].map(
      (c) => c.metas.speakerUuid,
    ),
  });

  // デフォルトスタイルID
  const defaultStyleIds: DefaultStyleId[] = characters.map((speaker) => ({
    engineId: engineId,
    speakerUuid: SpeakerId(speaker.speakerUuid),
    defaultStyleId: StyleId(speaker.styles[0].id),
  }));
  store.commit("SET_DEFAULT_STYLE_IDS", { defaultStyleIds });
}
