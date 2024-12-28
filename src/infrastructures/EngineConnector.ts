import { createEngineUrl, EngineUrlParams } from "@/domain/url";
import { createOpenAPIEngineMock } from "@/mock/engineMock";
import { Configuration, DefaultApi, DefaultApiInterface } from "@/openapi";

export interface IEngineConnectorFactory {
  // FIXME: hostという名前の時点で外部APIに接続するという知識が出てきてしまっているので
  // Factory自体に型パラメータを付けて、接続方法だったり設定、IDみたいな名前で表現する
  instance: (host: string) => DefaultApiInterface;
}

const OpenAPIEngineConnectorFactoryImpl = (): IEngineConnectorFactory => {
  const instanceMapper: Record<string, DefaultApiInterface> = {};
  return {
    instance: (host: string) => {
      const cached = instanceMapper[host];
      if (cached != undefined) {
        return cached;
      }
      const api = new DefaultApi(new Configuration({ basePath: host }));
      instanceMapper[host] = api;

      return api;
    },
  };
};

/** エンジン */
export const OpenAPIEngineConnectorFactory =
  OpenAPIEngineConnectorFactoryImpl();

const OpenAPIMockEngineConnectorFactoryImpl = (): IEngineConnectorFactory => {
  let mockInstance: DefaultApiInterface | undefined;
  return {
    instance: () => {
      if (!mockInstance) {
        mockInstance = createOpenAPIEngineMock();
      }
      return mockInstance;
    },
  };
};

/** モック用エンジン */
export const OpenAPIMockEngineConnectorFactory =
  OpenAPIMockEngineConnectorFactoryImpl();

/** モック用エンジンのURLは `mock://mock` とする */
export const mockUrlParams = {
  protocol: "mock:",
  hostname: "mock",
  port: "",
  pathname: "",
} satisfies EngineUrlParams;

/**
 * モック用エンジンのURLのときはモックを、そうじゃないときは通常エンジンを返す。
 */
export const OpenAPIEngineAndMockConnectorFactory: IEngineConnectorFactory = {
  instance: (host: string) => {
    if (host == createEngineUrl(mockUrlParams)) {
      return OpenAPIMockEngineConnectorFactory.instance(host);
    } else {
      return OpenAPIEngineConnectorFactory.instance(host);
    }
  },
};
