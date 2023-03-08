import { computed } from "vue";
import { voiceToVoiceId } from "@/lib/voice";
import { useStore } from "@/store";
import { PresetKey, Voice } from "@/type/preload";

export const useDefaultPreset = () => {
  const store = useStore();

  const defaultPresetKeys = computed(() => store.state.defaultPresetKeys);
  const defaultPresetKeySets = computed(
    () => new Set(Object.values(store.state.defaultPresetKeys))
  );

  const getDefaultPresetKeyForVoice = (voice: Voice): string => {
    const voiceId = voiceToVoiceId(voice);
    return defaultPresetKeys.value[voiceId];
  };

  const isDefaultPresetKey = (presetKey: PresetKey): boolean => {
    return defaultPresetKeySets.value.has(presetKey);
  };

  return {
    getDefaultPresetKeyForVoice,
    isDefaultPresetKey,
  };
};
