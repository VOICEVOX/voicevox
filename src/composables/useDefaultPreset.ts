import { computed } from "vue";
import { voiceToVoiceId } from "@/lib/voice";
import { useStore } from "@/store";
import { PresetKey, Voice } from "@/type/preload";

export const useDefaultPreset = () => {
  const store = useStore();

  const defaultPresetKeyMap = computed(() => store.state.defaultPresetKeyMap);
  const defaultPresetKeys = computed(
    () => new Set(Object.values(store.state.defaultPresetKeyMap))
  );

  const getDefaultPresetKeyForVoice = (voice: Voice): string => {
    const voiceId = voiceToVoiceId(voice);
    return defaultPresetKeyMap.value[voiceId];
  };

  const isDefaultPresetKey = (presetKey: PresetKey): boolean => {
    return defaultPresetKeys.value.has(presetKey);
  };

  return {
    getDefaultPresetKeyForVoice,
    isDefaultPresetKey,
  };
};
