import { ref, computed, Ref, Events } from "vue";
import { QSliderProps, debounce } from "quasar";
export type Props = {
  onPan?: QSliderProps["onPan"];
  onChange?: QSliderProps["onChange"];
  modelValue: () => number | null;
  min?: () => number;
  max?: () => number;
  disable?: () => boolean;
  step?: () => number;
  scrollStep?: () => number;
  scrollMinStep?: () => number;
  disableScroll?: () => boolean;
};

export type PreviewSliderHelper = {
  state: {
    currentValue: Ref<number | null>;
    isPanning: Ref<boolean>;
  };
  qSliderProps: Ref<{
    min: number;
    max: number;
    step: number;
    disable: boolean;
    "onUpdate:modelValue": (value: number) => void;
    onChange: (value: number) => void;
    onWheel: (event: Events["onWheel"]) => void;
    onPan: QSliderProps["onPan"];
  }>;
};

export const previewSliderHelper = (props: Props): PreviewSliderHelper => {
  const modelValue = computed(props.modelValue);
  const min = computed(() => (props.min && props.min()) ?? 0);
  const max = computed(() => (props.max && props.max()) ?? 100);
  const disable = computed(() => (props.disable && props.disable()) ?? false);
  const step = computed(() => (props.step && props.step()) ?? 1);
  const scrollStep = computed(
    () => (props.scrollStep && props.scrollStep()) ?? step.value
  );
  const scrollMinStep = computed(
    () => (props.scrollMinStep && props.scrollMinStep()) ?? scrollStep.value
  );
  const disableScroll = computed(
    () => (props.disableScroll && props.disableScroll()) ?? false
  );

  const previewValue = ref(modelValue.value);
  const isPanning = ref(false);
  const isScrolling = ref(false);

  const currentValue = computed(() => {
    if (isPanning.value || isScrolling.value) {
      return previewValue.value;
    } else {
      return modelValue.value;
    }
  });

  const updatePreviewValue = (value: number) => {
    previewValue.value = value;
  };
  const changePreviewValue = () => {
    if (previewValue.value === null)
      throw new Error("previewValue.value === null");
    if (modelValue.value !== previewValue.value && props.onChange)
      props.onChange(previewValue.value);
  };

  const onPan: QSliderProps["onPan"] = (phase) => {
    if (phase == "start") {
      // start panning
      isPanning.value = true;
    } else {
      // end panning
      isPanning.value = false;
    }
    if (props.onPan) props.onPan(phase);
  };

  const debounceScroll = debounce(() => {
    // end scroll
    isScrolling.value = false;
    changePreviewValue();
  }, 300);

  const scrollStepDecimals = computed(() => {
    return String(scrollStep.value).split(".")[1]?.length ?? 0;
  });
  const scrollMinStepDecimals = computed(() => {
    return String(scrollMinStep.value).split(".")[1]?.length ?? 0;
  });

  const onWheel = (event: Events["onWheel"]) => {
    if (disableScroll.value || disable.value || currentValue.value === null)
      return;
    event.preventDefault();
    const deltaY = event.deltaY;
    const ctrlKey = event.ctrlKey;
    const step = ctrlKey ? scrollMinStep.value : scrollStep.value;
    const decimals = ctrlKey
      ? scrollMinStepDecimals.value
      : scrollStepDecimals.value;
    const diff = -step * Math.sign(deltaY);
    const nextValue = Math.min(
      Math.max(currentValue.value + diff, min.value),
      max.value
    );
    updatePreviewValue(Number.parseFloat(nextValue.toFixed(decimals)));
    // start scroll
    isScrolling.value = true;
    debounceScroll();
  };

  const qSliderProps = computed(() => ({
    min: min.value,
    max: max.value,
    step: step.value,
    disable: disable.value,
    modelValue: currentValue.value,
    "onUpdate:modelValue": updatePreviewValue,
    onChange: changePreviewValue,
    onWheel,
    onPan,
  }));

  return {
    state: {
      currentValue,
      isPanning,
    },
    qSliderProps,
  };
};
