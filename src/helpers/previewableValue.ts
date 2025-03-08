import { Ref, ComputedRef, ref, computed } from "vue";

export class PreviewableValue {
  private isPreview: Ref<boolean>;

  private storeValue: ComputedRef<number | undefined>;

  private previewValue: Ref<number | undefined>;

  currentValue: ComputedRef<number | undefined>;

  constructor(storeFunc: () => number | undefined) {
    this.isPreview = ref(false);
    this.storeValue = computed(storeFunc);
    this.previewValue = ref(undefined);
    this.currentValue = computed(() =>
      this.isPreview.value ? this.previewValue.value : this.storeValue.value,
    );
  }

  setPreviewValue(newValue: number): void {
    this.previewValue.value = newValue;
  }

  startPreview(): void {
    this.isPreview.value = true;
    this.setPreviewValue(this.storeValue.value ?? 0.0);
  }

  stopPreview(): void {
    this.isPreview.value = false;
  }
}
