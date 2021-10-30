import { Configuration, DefaultApi, DefaultApiInterface } from "@/openapi";

export interface IEngineConnectorFactory {
  setActiveHost: (host: string) => void;
  instance: () => DefaultApiInterface;
}

const OpenAPIEngineConnectorFactoryImpl = (): IEngineConnectorFactory => {
  const instanceMapper: Record<string, DefaultApiInterface> = {};
  let activeHost: string;
  return {
    setActiveHost: (host: string) => {
      activeHost = host;
    },
    instance: () => {
      const cached = instanceMapper[activeHost];
      if (cached !== undefined) {
        return cached;
      }
      const api = new DefaultApi(new Configuration({ basePath: activeHost }));
      instanceMapper[activeHost] = api;

      return api;
    },
  };
};

const SingletonOpenAPIEngineConnectorFactory =
  OpenAPIEngineConnectorFactoryImpl();
SingletonOpenAPIEngineConnectorFactory.setActiveHost(
  process.env.VUE_APP_ENGINE_URL as unknown as string
);

export const OpenAPIEngineConnectorFactory =
  SingletonOpenAPIEngineConnectorFactory;
