<template>
  <div class="container">
    <div
      class="knob"
      @mousedown.prevent="onMouseDown"
      @dblclick.prevent="onDoubleClick"
      @wheel.prevent="onWheel"
    >
      <div class="knob-amount-background"></div>
      <div class="knob-amount-indicator"></div>
      <div class="knob-indicator"></div>
      <div class="knob-indicator-mask"></div>
    </div>
    <div class="knob-value" @dblclick="startInputMode">{{ displayValue }}</div>
    <input
      v-if="inputMode"
      ref="valueInput"
      :value="inputBuffer"
      class="knob-value-input"
      @input="onInput"
      @mousedown.stop
      @dblclick.stop
      @keydown.stop="onInputKeyDown"
      @blur="endInputMode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { clamp } from "@/sing/utility";

const linearToLog = (value: number, min: number, max: number) => {
  return Math.log10(value / min) / Math.log10(max / min);
};

const logToLinear = (logValue: number, min: number, max: number) => {
  return min * Math.pow(max / min, logValue);
};

const props = defineProps<{
  size: number;
  min: number;
  max: number;
  default?: number;
  logScale?: boolean;
}>();
const value = defineModel<number>({ required: true });

const KNOB_ANGLE_RANGE = 300;
const VALUE_ADJUSTMENT_STEPS = 200;
const LOG_SCALE_MIN = 1e-10;

const isKnobBeingDragged = ref(false);
const lastMousePosX = ref(0);
const lastMousePosY = ref(0);

const limitedMin = computed(() => {
  if (props.logScale && props.min < LOG_SCALE_MIN) {
    return props.min;
  }
  return props.min;
});

const limitedValue = computed(() => {
  return clamp(value.value, limitedMin.value, props.max);
});

const percentage = computed(() => {
  const range = props.max - limitedMin.value;
  if (props.logScale) {
    return linearToLog(limitedValue.value, limitedMin.value, props.max);
  }
  return (limitedValue.value - limitedMin.value) / range;
});

// cssで使用する値
const knobSize = computed(() => `${props.size}px`);
const knobStartAngle = computed(() => `${-KNOB_ANGLE_RANGE / 2}deg`);
const knobRangeAngle = computed(() => `${KNOB_ANGLE_RANGE}deg`);
const knobAngleFromStart = computed(() => {
  return `${percentage.value * KNOB_ANGLE_RANGE}deg`;
});
const knobAngleFromTop = computed(() => {
  return `${percentage.value * KNOB_ANGLE_RANGE - KNOB_ANGLE_RANGE / 2}deg`;
});

// 指定した桁数に収めて数値を文字列に変換する関数
const toStringWithLimitedNumberOfDigits = (value: number, digits: number) => {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const intPart = Math.trunc(value);
  const absIntPart = Math.abs(intPart);
  const absFracPart = Math.abs(value - intPart);

  const intPartDigits =
    absIntPart < 1 ? 1 : Math.floor(Math.log10(absIntPart)) + 1;

  if (intPartDigits >= digits) {
    return String(intPart);
  }

  const fracPartDigits = digits - intPartDigits;

  const fracPartStr = String(
    Math.floor(absFracPart * 10 ** fracPartDigits),
  ).padStart(fracPartDigits, "0");

  return `${intPart}.${fracPartStr}`;
};

const displayValue = computed(() => {
  return toStringWithLimitedNumberOfDigits(limitedValue.value, 4);
});

const changeValue = (delta: number) => {
  if (props.logScale) {
    const step = 1 / VALUE_ADJUSTMENT_STEPS;
    const currentLogValue = linearToLog(
      limitedValue.value,
      limitedMin.value,
      props.max,
    );
    const newLogValue = clamp(currentLogValue + delta * step, 0, 1);
    value.value = logToLinear(newLogValue, limitedMin.value, props.max);
  } else {
    const step = (props.max - limitedMin.value) / VALUE_ADJUSTMENT_STEPS;
    const newValue = limitedValue.value + delta * step;
    value.value = clamp(newValue, limitedMin.value, props.max);
  }
};

const onMouseDown = (event: MouseEvent) => {
  isKnobBeingDragged.value = true;
  lastMousePosX.value = event.clientX;
  lastMousePosY.value = event.clientY;
};

const onMouseMove = (event: MouseEvent) => {
  if (!isKnobBeingDragged.value) {
    return;
  }

  const deltaX = event.clientX - lastMousePosX.value;
  const deltaY = event.clientY - lastMousePosY.value;
  const delta = -deltaY + deltaX;

  lastMousePosX.value = event.clientX;
  lastMousePosY.value = event.clientY;

  changeValue(delta);
};

const onMouseUp = () => {
  isKnobBeingDragged.value = false;
};

const onDoubleClick = () => {
  if (props.default != undefined) {
    value.value = clamp(props.default, limitedMin.value, props.max);
  }
};

const onWheel = (event: WheelEvent) => {
  changeValue(-event.deltaY / 100);
};

const inputMode = ref(false);
const valueInput = ref<HTMLInputElement | null>(null);
const inputBuffer = ref("");
let isInputValueEdited = false;

const startInputMode = () => {
  inputBuffer.value = displayValue.value;
  isInputValueEdited = false;
  inputMode.value = true;
};

const endInputMode = () => {
  if (isInputValueEdited) {
    const inputNumber = Number(inputBuffer.value);
    if (Number.isFinite(inputNumber)) {
      value.value = clamp(inputNumber, limitedMin.value, props.max);
    }
  }
  inputMode.value = false;
};

const onInput = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) {
    throw new Error("Invalid event target");
  }
  inputBuffer.value = event.target.value;
  isInputValueEdited = true;
};

const onInputKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Enter" && !event.isComposing) {
    endInputMode();
  }
};

watch(
  inputMode,
  () => {
    if (inputMode.value) {
      void nextTick(() => {
        valueInput.value?.focus();
        valueInput.value?.select();
      });
    }
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
});

onUnmounted(() => {
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/colors" as colors;

.container {
  position: relative;
}

.knob {
  position: relative;
  width: v-bind(knobSize);
  height: v-bind(knobSize);
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: colors.$background;
  overflow: hidden;
}

.knob-amount-background {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(colors.$background 61%, transparent 63%),
    conic-gradient(
      colors.$surface v-bind(knobRangeAngle),
      transparent v-bind(knobRangeAngle)
    );
  transform: rotate(v-bind(knobStartAngle));
}

.knob-amount-indicator {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(colors.$background 61%, transparent 63%),
    conic-gradient(
      colors.$primary v-bind(knobAngleFromStart),
      transparent v-bind(knobAngleFromStart)
    );
  transform: rotate(v-bind(knobStartAngle));
}

.knob-indicator {
  position: absolute;
  top: 8%;
  width: 2px;
  height: 42%;
  background-color: colors.$primary;
  transform-origin: bottom center;
  transform: rotate(v-bind(knobAngleFromTop));
}

.knob-indicator-mask {
  position: absolute;
  top: 26%;
  width: 4px;
  height: 48%;
  background-color: colors.$background;
  transform-origin: center center;
  transform: rotate(v-bind(knobAngleFromTop));
}

.knob-value {
  position: absolute;
  display: inline-block;
  left: 50%;
  bottom: -26px;
  padding: 1px 2px;
  border: 1px solid colors.$surface;
  transform: translateX(-50%);
  z-index: 1;
}

.knob-value-input {
  position: absolute;
  left: 50%;
  bottom: -26px;
  width: 52px;
  transform: translateX(-50%);
  z-index: 2;
}
</style>
