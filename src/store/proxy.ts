import {
  IEngineConnectorFactory,
  OpenAPIEngineConnectorFactory,
} from "@/infrastructures/EngineConnector";
import {
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
      INVOKE_ENGINE_CONNECTOR({ rootState }, payload) {
        const instance = _engineFactory.instance(rootState.engineHost);
        const action = payload.action;
        const args = payload.payload;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return instance[action](...args);
      },
    },
  };
  return proxyStore;
};

export const proxyStore = proxyStoreCreator(OpenAPIEngineConnectorFactory);
