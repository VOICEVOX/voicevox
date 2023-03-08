import { computed } from "vue";
import { useStore } from "@/store";
import { PresetKey, Voice, VoiceId } from "@/type/preload";

export const useDefaultPreset = () => {
  const store = useStore();

  const defaultPresetKeys = computed(() => store.state.defaultPresetKeys);
  const defaultPresetKeySets = computed(
    () => new Set(Object.values(store.state.defaultPresetKeys))
  );

  const getDefaultPresetKeyForVoice = (voice: Voice): string => {
    const voiceId = VoiceId(voice);
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
