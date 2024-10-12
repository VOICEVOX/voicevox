import { ProxyStoreState, ProxyStoreTypes, EditorAudioQuery } from "./type";
import { createPartialStore } from "./vuex";
import { convertToUrlString } from "@/domain/url";
import {
  IEngineConnectorFactory,
  OpenAPIEngineConnectorFactory,
} from "@/infrastructures/EngineConnector";
import { AudioQuery } from "@/openapi";
import { EngineInfo } from "@/type/preload";

export const proxyStoreState: ProxyStoreState = {};

export const proxyStoreCreator = (_engineFactory: IEngineConnectorFactory) => {
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
          convertToUrlString({
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

export const proxyStore = proxyStoreCreator(OpenAPIEngineConnectorFactory);
