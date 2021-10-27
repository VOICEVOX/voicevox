<template>
  <div
    @mouseenter="handleMouseHover(true)"
    @mouseleave="handleMouseHover(false)"
  >
    <q-badge
      class="value-label"
      text-color="secondary"
      v-if="!disable && (valueLabel.visible || valueLabel.panning)"
    >
      {{ previewValue.currentValue.value.toFixed(precisionComputed) }}
    </q-badge>
    <q-slider
      vertical
      reverse
      snap
      :min="min"
      :max="max"
      :step="step"
      :disable="disable || uiLocked"
      :style="clipPathComputed"
      :model-value="previewValue.currentValue.value"
      @update:model-value="previewValue.setPreviewValue(parseFloat($event))"
      @change="changeValue(parseFloat($event))"
      @wheel="changeValueByScroll($event.deltaY, $event.ctrlKey)"
      @pan="setPanning"
    />
  </div>
</template>

<script lang="ts">
import { PreviewableValue } from "@/helpers/previewableValue";
import { MoraDataType } from "@/type/preload";
import { computed, defineComponent, onMounted, reactive, ref } from "vue";

export default defineComponent({
  name: "AudioParameter",

  props: {
    value: { type: Number, required: true },
    accentPhraseIndex: { type: Number, required: true },
    moraIndex: { type: Number, required: true },
    uiLocked: { type: Boolean, required: true },
    min: { type: Number, default: 0.0 },
    max: { type: Number, default: 10.0 },
    step: { type: Number, default: 0.01 },
    disable: { type: Boolean, default: false },
    type: { type: String as () => MoraDataType, default: "vowel" },
    clip: { type: Boolean, default: false },
    shiftKeyFlag: { type: Boolean, default: false },
  },

  emits: ["changeValue", "mouseOver"],

  watch: {
    value(newVal, oldVal) {
      if (this.type == "pitch" && this.lastPitch != 0) {
        if (newVal != 0) {
          if (oldVal == 0) {
            this.changeValue(this.lastPitch as number, "voicing");
          } else {
            this.lastPitch = newVal;
          }
        }
      }
    },
  },

  setup(props, { emit }) {
    const previewValue = new PreviewableValue(() => props.value);

    // warpping the props with a function removes its reactivity
    const initializePitch = () => {
      return props.value;
    };

    const lastPitch = ref<number | undefined>(undefined);
    onMounted(() => {
      if (props.type == "pitch") {
        lastPitch.value = initializePitch();
      }
    });

    const changeValue = (newValue: number, type: MoraDataType = props.type) => {
      emit(
        "changeValue",
        props.accentPhraseIndex,
        props.moraIndex,
        newValue,
        type
      );
    };

    const changeValueByScroll = (deltaY: number, withDetailedStep: boolean) => {
      const step = withDetailedStep ? props.step : props.step * 10;
      let newValue = props.value - (deltaY > 0 ? step : -step);
      if (newValue < props.min) newValue = props.min;
      if (newValue > props.max) newValue = props.max;
      if (!props.uiLocked && !props.shiftKeyFlag) {
        changeValue(newValue);
      }
    };

    const valueLabel = reactive({
      visible: false,
      // NOTE: q-slider操作中の表示のON/OFFは@panに渡ってくるphaseで判定する
      // SEE: https://github.com/quasarframework/quasar/issues/7739#issuecomment-689664504
      panning: false,
    });

    const setPanning = (panningPhase: string) => {
      if (panningPhase === "start") {
        valueLabel.panning = true;
        previewValue.startPreview();
      } else {
        valueLabel.panning = false;
        previewValue.stopPreview();
      }
    };

    const clipPathComputed = computed((): string => {
      if (!props.clip) {
        return "";
      } else {
        if (props.type == "vowel") {
          return "clip-path: inset(-50% -50% -50% 50%)";
        } else {
          return "clip-path: inset(-50% 50% -50% -50%)";
        }
      }
    });

    const handleMouseHover = (isOver: boolean) => {
      valueLabel.visible = isOver;
      if (props.type == "consonant" || props.type == "vowel") {
        emit(
          "mouseOver",
          isOver,
          props.type,
          props.accentPhraseIndex,
          props.moraIndex
        );
      }
    };

    const precisionComputed = computed(() => {
      if (props.type == "pause" || props.type == "pitch") {
        return 2;
      } else {
        return 3;
      }
    });

    return {
      previewValue,
      changeValue,
      changeValueByScroll,
      valueLabel,
      setPanning,
      clipPathComputed,
      handleMouseHover,
      precisionComputed,
      lastPitch,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles' as global;

$value-label-height: 24px;

div {
  position: absolute;
  top: 8px;
  bottom: 8px;
  .q-slider {
    height: calc(100% - #{$value-label-height + 12px});
    margin-top: $value-label-height + 12px;
    min-width: 30px;
    max-width: 30px;
    :deep(.q-slider__track-container--v) {
      margin-left: -1.5px;
      width: 3px;
    }
  }
  .value-label {
    height: $value-label-height;
    padding: 0px 8px;
    transform: translateX(-50%) translateX(15px);
  }
}
</style>
