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
    isScrolling: Ref<boolean>;
    isAwaiting: Ref<boolean>;
  };
  qSliderProps: {
    min: Ref<number>;
    max: Ref<number>;
    step: Ref<number>;
    disable: Ref<boolean>;
    "onUpdate:modelValue": (value: number) => void;
    onChange: (value: number) => void;
    onWheel: (event: Events["onWheel"]) => void;
    onPan: QSliderProps["onPan"];
  };
};

class CancelableFinary {
  isCanceled: boolean;

  constructor(promise: Promise<void>, func: (...args: unknown[]) => unknown) {
    this.isCanceled = false;
    promise.finally(() => {
      if (!this.isCanceled) func();
    });
  }

  cancel() {
    this.isCanceled = true;
  }
}

/**
 * スライダー用のヘルパー関数。ホイール操作やプレビュー値表示の機能がある。
 * @param props
 * q-sliderの描画に用いる引数
 * reactiveにする為にcomputedの引数の様に算出関数を渡す。
 * @returns QSliderProps
 * + state
 *   currentValue等、Slider外での描画の為に用いることができる変数
 * + qSliderProps
 *   q-sliderに渡すべきprops
 */
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
  const isAwaiting = ref(false);

  const currentValue = computed(() => {
    if (isPanning.value || isScrolling.value || isAwaiting.value) {
      return previewValue.value;
    } else {
      return modelValue.value;
    }
  });

  const updatePreviewValue = (value: number) => {
    previewValue.value = value;
  };
  const changePreviewValue = async () => {
    if (previewValue.value === null)
      throw new Error("previewValue.value === null");
    if (modelValue.value !== previewValue.value && props.onChange) {
      const ret: unknown = props.onChange(previewValue.value);
      if (ret instanceof Promise) await ret;
    }
  };

  let awaitingChange: CancelableFinary | null = null;
  const endAwaiting = () => {
    isAwaiting.value = false;
  };
  const fireChange = () => {
    if (awaitingChange !== null) awaitingChange.cancel();
    isAwaiting.value = true;
    awaitingChange = new CancelableFinary(changePreviewValue(), endAwaiting);
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
    fireChange();
    isScrolling.value = false;
  }, 300);

  const scrollStepDecimals = computed(() => {
    return String(scrollStep.value).split(".")[1]?.length ?? 0;
  });
  const scrollMinStepDecimals = computed(() => {
    return String(scrollMinStep.value).split(".")[1]?.length ?? 0;
  });
  const scrollDecimals = computed(() =>
    Math.max(scrollStepDecimals.value, scrollMinStepDecimals.value)
  );

  const onWheel = (event: Events["onWheel"]) => {
    if (disableScroll.value || disable.value || currentValue.value === null)
      return;
    event.preventDefault();
    const deltaY = event.deltaY;
    const ctrlKey = event.ctrlKey;
    const step = ctrlKey ? scrollMinStep.value : scrollStep.value;
    const diff = -step * Math.sign(deltaY);
    const nextValue = Math.min(
      Math.max(currentValue.value + diff, min.value),
      max.value
    );
    updatePreviewValue(
      Number.parseFloat(nextValue.toFixed(scrollDecimals.value))
    );
    // start scroll
    isScrolling.value = true;
    debounceScroll();
  };

  const qSliderProps = {
    min: min,
    max: max,
    step: step,
    disable: disable,
    modelValue: currentValue,
    "onUpdate:modelValue": updatePreviewValue,
    onChange: fireChange,
    onWheel,
    onPan,
  };

  return {
    state: {
      currentValue,
      isPanning,
      isScrolling,
      isAwaiting,
    },
    qSliderProps,
  };
};
