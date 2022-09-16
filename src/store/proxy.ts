import {
  IEngineConnectorFactory,
  OpenAPIEngineConnectorFactory,
} from "@/infrastructures/EngineConnector";
import { AudioQuery } from "@/openapi";
import { EngineInfo } from "@/type/preload";
import {
  EditorAudioQuery,
  ProxyActions,
  ProxyGetters,
  ProxyMutations,
  ProxyStoreState,
  VoiceVoxStoreOptions,
} from "./type";

export const proxyStoreState: ProxyStoreState = {};

const proxyStoreCreator = (
  _engineFactory: IEngineConnectorFactory
): VoiceVoxStoreOptions<ProxyGetters, ProxyActions, ProxyMutations> => {
  const proxyStore: VoiceVoxStoreOptions<
    ProxyGetters,
    ProxyActions,
    ProxyMutations
  > = {
    getters: {},
    mutations: {},
    actions: {
      INSTANTIATE_ENGINE_CONNECTOR({ state }, payload) {
        const engineId = payload.engineId;
        const engineInfo: EngineInfo | undefined = state.engineInfos[engineId];
        if (engineInfo === undefined)
          throw new Error(
            `No such engineInfo registered: engineId == ${engineId}`
          );

        const instance = _engineFactory.instance(engineInfo.host);
        return Promise.resolve({
          invoke: (v) => (arg) =>
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            instance[v](arg) as any,
        });
      },
    },
  };
  return proxyStore;
};

export const convertToEditorAudioQuery = (
  audioQuery: AudioQuery
): EditorAudioQuery => {
  return { ...audioQuery };
};

export const convertFromEditorAudioQuery = (
  editorAudioQuery: EditorAudioQuery,
  defaultOutputSamplingRate: number
): AudioQuery => {
  return {
    ...editorAudioQuery,
    outputSamplingRate:
      editorAudioQuery.outputSamplingRate == "default"
        ? defaultOutputSamplingRate
        : editorAudioQuery.outputSamplingRate,
  };
};

export const proxyStore = proxyStoreCreator(OpenAPIEngineConnectorFactory);
