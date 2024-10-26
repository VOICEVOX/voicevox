import { convertToUrlString, EngineUrlParams } from "@/domain/url";
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

/** WEB APIを持つエンジン用 */
export const OpenAPIEngineConnectorFactory =
  OpenAPIEngineConnectorFactoryImpl();

const OpenAPIMockEngineConnectorFactoryImpl = (): IEngineConnectorFactory => ({
  instance: () => createOpenAPIEngineMock(),
});

/** WEB APIを持つエンジンを模したモック用 */
export const OpenAPIMockEngineConnectorFactory =
  OpenAPIMockEngineConnectorFactoryImpl();

/** モック用エンジンのURLは `http://mock` とする */
export const mockUrlParams = {
  protocol: "http:",
  hostname: "mock",
  port: "",
  pathname: "",
} satisfies EngineUrlParams;

/**
 * WEB API エンジンとモックを使い分ける用。
 * モック用エンジンのURLのときはモックを返す。
 */
export const OpenAPIEngineAndMockConnectorFactory: IEngineConnectorFactory = {
  instance: (host: string) => {
    if (host === convertToUrlString(mockUrlParams)) {
      return OpenAPIMockEngineConnectorFactory.instance(host);
    }
    return OpenAPIEngineConnectorFactory.instance(host);
  },
};
