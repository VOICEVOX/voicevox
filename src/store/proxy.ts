import {
  IEngineConnectorFactory,
  OpenAPIEngineConnectorFactory,
} from "@/infrastructures/EngineConnector";
import { EngineInfo } from "@/type/preload";
import { ProxyStoreState, ProxyStoreTypes } from "./type";
import { createPartialStore } from "./utility";

export const proxyStoreState: ProxyStoreState = {};

const proxyStoreCreator = (_engineFactory: IEngineConnectorFactory) => {
  const proxyStore = createPartialStore<ProxyStoreTypes>({
    INSTANTIATE_ENGINE_CONNECTOR: {
      action({ state }, payload) {
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
  });
  return proxyStore;
};

export const proxyStore = proxyStoreCreator(OpenAPIEngineConnectorFactory);
