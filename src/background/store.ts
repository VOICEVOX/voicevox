import Store, { Schema } from "electron-store";
import zodToJsonSchema from "zod-to-json-schema";
import {
  AcceptTermsStatus,
  ElectronStoreType,
  EngineId,
  electronStoreSchema,
} from "@/type/preload";

export function getStore() {
  const electronStoreJsonSchema = zodToJsonSchema(electronStoreSchema);
  if (!("properties" in electronStoreJsonSchema)) {
    throw new Error("electronStoreJsonSchema must be object");
  }
  return new Store<ElectronStoreType>({
    schema: electronStoreJsonSchema.properties as Schema<ElectronStoreType>,
    migrations: {
      ">=0.13": (store) => {
        // acceptTems -> acceptTerms
        const prevIdentifier = "acceptTems";
        const prevValue = store.get(prevIdentifier, undefined) as
          | AcceptTermsStatus
          | undefined;
        if (prevValue) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          store.delete(prevIdentifier as any);
          store.set("acceptTerms", prevValue);
        }
      },
      ">=0.14": (store) => {
        // FIXME: できるならEngineManagerからEnginIDを取得したい
        if (process.env.DEFAULT_ENGINE_INFOS == undefined)
          throw new Error("DEFAULT_ENGINE_INFOS == undefined");
        const engineId = EngineId(
          JSON.parse(process.env.DEFAULT_ENGINE_INFOS)[0].uuid
        );
        if (engineId == undefined)
          throw new Error("DEFAULT_ENGINE_INFOS[0].uuid == undefined");
        const prevDefaultStyleIds = store.get("defaultStyleIds");
        store.set(
          "defaultStyleIds",
          prevDefaultStyleIds.map((defaultStyle) => ({
            engineId,
            speakerUuid: defaultStyle.speakerUuid,
            defaultStyleId: defaultStyle.defaultStyleId,
          }))
        );

        const outputSamplingRate: number =
          // @ts-expect-error 削除されたパラメータ。
          store.get("savingSetting").outputSamplingRate;
        store.set(`engineSettings.${engineId}`, {
          useGpu: store.get("useGpu"),
          outputSamplingRate:
            outputSamplingRate === 24000 ? "engineDefault" : outputSamplingRate,
        });
        // @ts-expect-error 削除されたパラメータ。
        store.delete("savingSetting.outputSamplingRate");
        // @ts-expect-error 削除されたパラメータ。
        store.delete("useGpu");
      },
    },
  });
}
