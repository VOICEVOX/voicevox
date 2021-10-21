<template>
  <q-slider
    v-bind="qSliderProps"
    :model-value="currentValue"
    @update:model-value="updatePreviewValue"
    @pan="onPan"
    @wheel="onWheel"
    @change="changeValue"
  >
  </q-slider>
</template>

<script lang="ts">
import { defineComponent, ref, computed, Events } from "vue";
import { QSliderProps, debounce } from "quasar";

export default defineComponent({
  name: "PreviewSlider",
  props: {
    modelValue: {
      type: Number,
      required: true,
    },
    min: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 0,
    },
    step: {
      type: Number,
      default: 1,
    },
    scrollStep: {
      type: Number,
      required: false,
    },
    scrollMinStep: {
      type: Number,
      required: false,
    },
    disableScroll: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["onUpdate:modelValue", "onChange", "onPan"],
  setup(props, context) {
    const previewValue = ref(props.modelValue);
    const isPanning = ref(false);
    const isScrolling = ref(false);

    const currentValue = computed(() => {
      if (isPanning.value || isScrolling.value) {
        return previewValue.value;
      } else {
        return props.modelValue;
      }
    });

    const updatePreviewValue = (value: number) => {
      previewValue.value = value;
      context.emit("onUpdate:modelValue", value);
    };
    const changeValue = () => {
      context.emit("onChange", previewValue.value);
    };

    const onPan: QSliderProps["onPan"] = (phase) => {
      if (phase == "start") {
        // start panning
        isPanning.value = true;
      } else {
        // end panning
        isPanning.value = false;
      }
      context.emit("onPan", phase);
    };

    const debounceScroll = debounce(() => {
      // end scroll
      isScrolling.value = false;
      changeValue();
    }, 300);

    const onWheel = (event: Events["onWheel"]) => {
      if (props.disableScroll) return;
      event.preventDefault();
      const deltaY = event.deltaY;
      const ctrlKey = event.ctrlKey;
      const step =
        (ctrlKey ? props.scrollMinStep : props.scrollStep) ??
        props.scrollStep ??
        props.step;
      const diff = -step * Math.sign(deltaY);
      updatePreviewValue(
        Math.min(Math.max(currentValue.value + diff, props.min), props.max)
      );
      // start scroll
      isScrolling.value = true;
      debounceScroll();
    };

    const qSliderProps = computed(() => ({
      step: props.step,
      min: props.min,
      max: props.max,
      ...context.attrs,
    }));

    return {
      currentValue,
      updatePreviewValue,
      changeValue,
      qSliderProps,
      onPan,
      onWheel,
    };
  },
});
</script>
