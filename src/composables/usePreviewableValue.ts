import { ref, computed } from "vue";

export function usePreviewableValue<T extends string | number>(
  storeFunc: () => T,
) {
  const isPreview = ref(false);
  const storeValue = computed(storeFunc);
  const previewValue = ref<T>(storeFunc());

  const currentValue = computed<T>(() =>
    isPreview.value ? previewValue.value : storeValue.value,
  );

  function startPreview(): void {
    isPreview.value = true;
    updatePreviewValue(storeValue.value);
  }

  function updatePreviewValue(newValue: T): void {
    previewValue.value = newValue;
  }

  function stopPreview(): void {
    isPreview.value = false;
  }

  return { currentValue, updatePreviewValue, startPreview, stopPreview };
}
