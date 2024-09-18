import { ref, computed } from "vue";
import { PreviewMode } from "@/type/preload";

const previewMode = ref<PreviewMode>("IDLE");
const nowPreviewing = computed(() => previewMode.value !== "IDLE");
const executePreviewProcess = ref(false);

const setPreviewMode = (mode: PreviewMode) => {
  previewMode.value = mode;
};

const clearPreviewMode = () => {
  previewMode.value = "IDLE";
};

export const usePreviewMode = () => {
  return {
    previewMode,
    nowPreviewing,
    setPreviewMode,
    clearPreviewMode,
    executePreviewProcess,
  };
};
