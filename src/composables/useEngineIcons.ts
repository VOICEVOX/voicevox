import { watch, ref, WatchSource } from "vue";
import { base64ImageToUri } from "@/helpers/base64Helper";
import { EngineManifest } from "@/openapi";
import { EngineId } from "@/type/preload";

export const useEngineIcons = (
  engineManifests: WatchSource<Record<EngineId, EngineManifest>>,
) => {
  const result = ref<Record<EngineId, string>>({});

  watch(
    engineManifests,
    async (engineManifests) => {
      const engineIcons: Record<EngineId, string> = {};
      for (const [engineId, manifest] of Object.entries(engineManifests)) {
        engineIcons[EngineId(engineId)] = await base64ImageToUri(manifest.icon);
      }

      result.value = engineIcons;
    },
    {
      immediate: true,
    },
  );

  return result;
};
