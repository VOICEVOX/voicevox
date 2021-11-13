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
        const action = _engineFactory.instance(rootState.engineHost)[
          payload.action
        ];
        const args = payload.payload;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return action(...args);
      },
    },
  };
  return proxyStore;
};

export const proxyStore = proxyStoreCreator(OpenAPIEngineConnectorFactory);
