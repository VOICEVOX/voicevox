import { ProxyStoreState, ProxyStoreTypes, EditorAudioQuery } from "./type.ts";
import { createPartialStore } from "./vuex.ts";
import { createEngineUrl } from "@/domain/url.ts";
import { isElectron, isProduction } from "@/helpers/platform.ts";
import {
  IEngineConnectorFactory,
  OpenAPIEngineAndMockConnectorFactory,
  OpenAPIEngineConnectorFactory,
} from "@/infrastructures/EngineConnector.ts";
import { AudioQuery } from "@/openapi/index.ts";
import { EngineInfo } from "@/type/preload.ts";

export const proxyStoreState: ProxyStoreState = {};

const proxyStoreCreator = (_engineFactory: IEngineConnectorFactory) => {
  const proxyStore = createPartialStore<ProxyStoreTypes>({
    INSTANTIATE_ENGINE_CONNECTOR: {
      action({ state }, payload) {
        const engineId = payload.engineId;
        const engineInfo: EngineInfo | undefined = state.engineInfos[engineId];
        if (engineInfo == undefined)
          return Promise.reject(
            new Error(`No such engineInfo registered: engineId == ${engineId}`),
          );

        const altPort: string | undefined = state.altPortInfos[engineId];
        const port = altPort ?? engineInfo.defaultPort;
        const instance = _engineFactory.instance(
          createEngineUrl({
            protocol: engineInfo.protocol,
            hostname: engineInfo.hostname,
            port,
            pathname: engineInfo.pathname,
          }),
        );
        return Promise.resolve({
          invoke: (v) => (arg) =>
            // FIXME: anyを使わないようにする
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
            instance[v](arg) as any,
        });
      },
    },
  });
  return proxyStore;
};

/** AudioQueryをエンジン用に変換する */
export const convertAudioQueryFromEditorToEngine = (
  editorAudioQuery: EditorAudioQuery,
  defaultOutputSamplingRate: number,
): AudioQuery => {
  return {
    ...editorAudioQuery,
    outputSamplingRate:
      editorAudioQuery.outputSamplingRate == "engineDefault"
        ? defaultOutputSamplingRate
        : editorAudioQuery.outputSamplingRate,
  };
};

/** AudioQueryをエディタ用に変換する */
export const convertAudioQueryFromEngineToEditor = (
  engineAudioQuery: AudioQuery,
): EditorAudioQuery => {
  return {
    ...engineAudioQuery,
    pauseLengthScale: engineAudioQuery.pauseLengthScale ?? 1,
  };
};

// 製品PC版は通常エンジンのみを、それ以外はモックエンジンも使えるようする
const getConnectorFactory = () => {
  if (isElectron && isProduction) {
    return OpenAPIEngineConnectorFactory;
  }
  return OpenAPIEngineAndMockConnectorFactory;
};
export const proxyStore = proxyStoreCreator(getConnectorFactory());
