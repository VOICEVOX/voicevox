import { createEngineUrl, type EngineUrlParams } from "@/domain/url";
import { Configuration, DefaultApi, type DefaultApiInterface } from "@/openapi";

export interface IEngineConnectorFactory {
  // FIXME: hostという名前の時点で外部APIに接続するという知識が出てきてしまっているので
  // Factory自体に型パラメータを付けて、接続方法だったり設定、IDみたいな名前で表現する
  instance: (host: string) => DefaultApiInterface;
}

// 通常エンジン
const OpenAPIEngineConnectorFactoryImpl =
  async (): Promise<IEngineConnectorFactory> => {
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
export const OpenAPIEngineConnectorFactory =
  OpenAPIEngineConnectorFactoryImpl();

// モック用エンジン
const OpenAPIMockEngineConnectorFactoryImpl =
  async (): Promise<IEngineConnectorFactory> => {
    let mockInstance: DefaultApiInterface | undefined;
    const { createOpenAPIEngineMock } = await import("@/mock/engineMock");
    return {
      instance: () => {
        if (!mockInstance) {
          mockInstance = createOpenAPIEngineMock();
        }
        return mockInstance;
      },
    };
  };
export const OpenAPIMockEngineConnectorFactory =
  /* @__PURE__ */ OpenAPIMockEngineConnectorFactoryImpl();

// 通常エンジンとモック用エンジンの両対応
// モック用エンジンのURLのときはモックを、そうじゃないときは通常エンジンを返す。
const OpenAPIEngineAndMockConnectorFactoryImpl =
  async (): Promise<IEngineConnectorFactory> => {
    // モック用エンジンのURLは `mock://mock` とする
    const mockUrlParams: EngineUrlParams = {
      protocol: "mock:",
      hostname: "mock",
      port: "",
      pathname: "",
    };
    const mockFactory = await OpenAPIMockEngineConnectorFactory;
    const openAPIFactory = await OpenAPIEngineConnectorFactory;

    return {
      instance: (host: string) => {
        if (host == createEngineUrl(mockUrlParams)) {
          return mockFactory.instance(host);
        } else {
          return openAPIFactory.instance(host);
        }
      },
    };
  };
export const OpenAPIEngineAndMockConnectorFactory =
  /* @__PURE__ */ OpenAPIEngineAndMockConnectorFactoryImpl();
