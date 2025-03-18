import Ajv, { JSONSchemaType, ValidateFunction } from "ajv";
import openapi from "../../openapi.json";
import { ProxyStoreState, ProxyStoreTypes, EditorAudioQuery } from "./type";
import { createPartialStore } from "./vuex";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { createEngineUrl } from "@/domain/url";
import { isElectron, isProduction } from "@/helpers/platform";
import {
  IEngineConnectorFactory,
  OpenAPIEngineAndMockConnectorFactory,
  OpenAPIEngineConnectorFactory,
} from "@/infrastructures/EngineConnector";
import { AudioQuery, DefaultApiInterface } from "@/openapi";
import { EngineInfo } from "@/type/preload";

export const proxyStoreState: ProxyStoreState = {};

const validateOpenApiResponse = createValidateOpenApiResponse();

function toCamelCase(str: string) {
  return str.replace(/_./g, (s) => s.charAt(1).toUpperCase());
}

/** OpenAPIのレスポンスを検証する */
function createValidateOpenApiResponse() {
  const ajv = new Ajv().addSchema({
    $id: "openapi.json",
    definitions: patchOpenApiJson(openapi).components.schemas,
  });
  const validatorCache = new Map<string, ValidateFunction>();

  for (const path of Object.values(openapi.paths)) {
    for (const rawMethod of Object.values(path)) {
      const method = rawMethod as {
        operationId: string;
        responses: Record<
          string,
          { content?: Record<string, { schema?: unknown }> }
        >;
      };
      const schema = method.responses["200"]?.content?.["application/json"]
        ?.schema as JSONSchemaType<unknown>;
      if (schema == null) {
        continue;
      }
      validatorCache.set(
        toCamelCase(method.operationId),
        ajv.compile(patchOpenApiJson(schema)),
      );
    }
  }

  return <K extends keyof DefaultApiInterface>(
    key: K,
    response: ReturnType<DefaultApiInterface[K]>,
  ): ReturnType<DefaultApiInterface[K]> => {
    return response.then((res) => {
      const maybeValidator = validatorCache.get(key);
      if (maybeValidator == null) {
        return res;
      }

      if (!maybeValidator(res)) {
        throw new Error(
          `Response validation error in ${key}: ${ajv.errorsText(maybeValidator.errors)}`,
        );
      }

      return res;
    }) as ReturnType<DefaultApiInterface[K]>;
  };
}

/**
 * OpenAPIのスキーマを修正する。
 *
 * 具体的には以下の変更を行う：
 * - `$ref`の参照先を`#/components/schemas/`から`openapi.json#/definitions/`に変更する
 * - オブジェクトのプロパティ名をキャメルケースに変換する
 */
function patchOpenApiJson<T extends Record<string, unknown>>(schema: T): T {
  return inner(cloneWithUnwrapProxy(schema)) as T;

  function inner(schema: Record<string, unknown>): Record<string, unknown> {
    if (schema["$ref"] != null) {
      const ref = schema["$ref"];
      if (typeof ref === "string") {
        schema["$ref"] = ref.replace(
          "#/components/schemas/",
          "openapi.json#/definitions/",
        );
      }
    }

    if (
      schema["type"] === "object" &&
      typeof schema["properties"] === "object" &&
      schema["properties"] != null &&
      Array.isArray(schema["required"])
    ) {
      schema["properties"] = Object.fromEntries(
        Object.entries(schema["properties"]).map(([key, value]) => [
          toCamelCase(key),
          inner(value as Record<string, unknown>),
        ]),
      );

      schema["required"] = schema["required"].map((key: string) =>
        toCamelCase(key),
      );
    }

    for (const key in schema) {
      if (typeof schema[key] === "object" && schema[key] != null) {
        inner(schema[key] as Record<string, unknown>);
      }
    }
    return schema;
  }
}

const proxyStoreCreator = (_engineFactory: IEngineConnectorFactory) => {
  const proxyStore = createPartialStore<ProxyStoreTypes>({
    INSTANTIATE_ENGINE_CONNECTOR: {
      action({ state }, payload) {
        const engineId = payload.engineId;
        const engineInfo: EngineInfo | undefined = state.engineInfos[engineId];
        if (engineInfo == undefined)
          return Promise.reject(
            new Error(`No such engineInfo registered: engineId == ${engineId}`),
          );

        const altPort: string | undefined = state.altPortInfos[engineId];
        const port = altPort ?? engineInfo.defaultPort;
        const instance = _engineFactory.instance(
          createEngineUrl({
            protocol: engineInfo.protocol,
            hostname: engineInfo.hostname,
            port,
            pathname: engineInfo.pathname,
          }),
        );
        return Promise.resolve({
          invoke: (v) => (arg) =>
            validateOpenApiResponse(
              v,
              // @ts-expect-error 動いているので無視
              instance[v](arg),
            ),
        });
      },
    },
  });
  return proxyStore;
};

/** AudioQueryをエンジン用に変換する */
export const convertAudioQueryFromEditorToEngine = (
  editorAudioQuery: EditorAudioQuery,
  defaultOutputSamplingRate: number,
): AudioQuery => {
  return {
    ...editorAudioQuery,
    outputSamplingRate:
      editorAudioQuery.outputSamplingRate == "engineDefault"
        ? defaultOutputSamplingRate
        : editorAudioQuery.outputSamplingRate,
  };
};

/** AudioQueryをエディタ用に変換する */
export const convertAudioQueryFromEngineToEditor = (
  engineAudioQuery: AudioQuery,
): EditorAudioQuery => {
  return {
    ...engineAudioQuery,
    pauseLengthScale: engineAudioQuery.pauseLengthScale ?? 1,
  };
};

// 製品PC版は通常エンジンのみを、それ以外はモックエンジンも使えるようする
const getConnectorFactory = () => {
  if (isElectron && isProduction) {
    return OpenAPIEngineConnectorFactory;
  }
  return OpenAPIEngineAndMockConnectorFactory;
};
export const proxyStore = proxyStoreCreator(getConnectorFactory());
