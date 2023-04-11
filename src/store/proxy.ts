import { ProxyStoreState, ProxyStoreTypes, EditorAudioQuery } from "./type";
import { createPartialStore } from "./vuex";
import {
  IEngineConnectorFactory,
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
        if (engineInfo === undefined)
          return Promise.reject(
            new Error(`No such engineInfo registered: engineId == ${engineId}`)
          );

        const instance = _engineFactory.instance(engineInfo.host);
        return Promise.resolve({
          invoke: (v) => (arg) =>
            // FIXME: anyを使わないようにする
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            instance[v](arg) as any,
        });
      },
    },
  });
  return proxyStore;
};

export const convertAudioQueryFromEditorToEngine = (
  editorAudioQuery: EditorAudioQuery,
  defaultOutputSamplingRate: number
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
