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
      INVOKE_ENGINE_CONNECTOR({ state }, payload) {
        const engineKey = payload.engineKey;
        const engineInfo = state.engineInfos.find(
          (engineInfo) => engineInfo.key === engineKey
        );
        if (!engineInfo)
          throw new Error(
            `No such engineInfo registered: engineKey == ${engineKey}`
          );

        const instance = _engineFactory.instance(engineInfo.host);
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
