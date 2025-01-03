import { ProxyStoreState, ProxyStoreTypes, EditorAudioQuery } from "./type";
import { createPartialStore } from "./vuex";
import { createEngineUrl } from "@/domain/url";
import { isElectron, isProduction } from "@/helpers/platform";
import {
  IEngineConnectorFactory,
  OpenAPIEngineAndMockConnectorFactory,
  OpenAPIEngineConnectorFactory,
} from "@/infrastructures/EngineConnector";
import { AudioQuery } from "@/openapi";
import { EngineInfo } from "@/type/preload";

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
