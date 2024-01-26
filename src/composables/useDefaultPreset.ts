import { computed } from "vue";
import { useStore } from "@/store";
import { PresetKey, Voice, VoiceId } from "@/type/preload";

export const useDefaultPreset = () => {
  const store = useStore();

  const defaultPresetKeys = computed(() => store.state.defaultPresetKeys);

  const getDefaultPresetKeyForVoice = (voice: Voice): string => {
    const voiceId = VoiceId(voice);
    return defaultPresetKeys.value[voiceId];
  };

  const isDefaultPresetKey = (presetKey: PresetKey): boolean => {
    return store.getters.DEFAULT_PRESET_KEY_SETS.has(presetKey);
  };

  return {
    getDefaultPresetKeyForVoice,
    isDefaultPresetKey,
  };
};
