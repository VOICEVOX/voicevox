import {
  IEngineConnectorFactory,
  OpenAPIEngineConnectorFactory,
} from "@/infrastructures/EngineConnector";
import { EngineInfo } from "@/type/preload";
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
      INSTANTIATE_ENGINE_CONNECTOR({ state }, payload) {
        const engineKey = payload.engineKey;
        const engineInfo: EngineInfo | undefined = state.engineInfos[engineKey];
        if (engineInfo === undefined)
          throw new Error(
            `No such engineInfo registered: engineKey == ${engineKey}`
          );

        const instance = _engineFactory.instance(engineInfo.host);
        return Promise.resolve(instance);
      },
    },
  };
  return proxyStore;
};

export const proxyStore = proxyStoreCreator(OpenAPIEngineConnectorFactory);
