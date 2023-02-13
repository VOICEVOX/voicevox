import { voiceToVoiceId } from "@/lib/voice";
import { useStore } from "@/store";
import { Voice } from "@/type/preload";
import { computed } from "vue";

export const useDefaultPreset = () => {
  const store = useStore();

  const defaultPresetKeyMap = computed(() => store.state.defaultPresetKeyMap);
  const defaultPresetKeys = computed(
    () => new Set(Object.values(store.state.defaultPresetKeyMap))
  );

  const getDefaultPresetKey = (voice: Voice): string => {
    const voiceId = voiceToVoiceId(voice);
    return defaultPresetKeyMap.value[voiceId];
  };

  const isDefaultPresetKey = (presetKey: string): boolean => {
    return defaultPresetKeys.value.has(presetKey);
  };

  return {
    getDefaultPresetKey,
    isDefaultPresetKey,
  };
};
