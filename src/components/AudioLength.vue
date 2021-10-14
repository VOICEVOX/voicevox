<template>
  <div v-if="isPause">
    <q-badge
      class="value-label"
      text-color="secondary"
      v-if="valueLabel.vowel_visible || valueLabel.vowel_panning"
    >
      {{ vowelPreviewValue.currentValue.value.toPrecision(2) }}
    </q-badge>
    <!-- slider for pause -->
    <q-slider
      @mouseenter="handleMouseHover('pause', true)"
      @mouseleave="handleMouseHover('pause', false)"
      vertical
      reverse
      snap
      :min="min"
      :max="max"
      :step="step"
      :disable="uiLocked"
      :model-value="vowelPreviewValue.currentValue.value"
      @update:model-value="
        vowelPreviewValue.setPreviewValue(parseFloat($event))
      "
      @change="changeValue(parseFloat($event), 'vowel')"
      @wheel="changeValueByScroll($event.deltaY, $event.ctrlKey, 'vowel')"
      @pan="setPanning($event, 'vowel')"
    />
  </div>
  <!-- when it consists of consonant and vowel -->
  <div v-else-if="consonantPreviewValue.currentValue.value !== undefined">
    <q-badge
      class="value-label"
      text-color="secondary"
      v-if="valueLabel.consonant_visible || valueLabel.consonant_panning"
    >
      {{ consonantPreviewValue.currentValue.value.toFixed(3) }}
    </q-badge>
    <q-badge
      class="value-label"
      text-color="secondary"
      v-if="valueLabel.vowel_visible || valueLabel.vowel_panning"
    >
      {{ vowelPreviewValue.currentValue.value.toFixed(3) }}
    </q-badge>
    <!-- consonant -->
    <q-slider
      @mouseenter="handleMouseHover('consonant', true)"
      @mouseleave="handleMouseHover('consonant', false)"
      vertical
      reverse
      snap
      :min="min"
      :max="max"
      :step="step"
      :disable="uiLocked"
      style="clip-path: inset(-50% 50% -50% -50%)"
      :model-value="consonantPreviewValue.currentValue.value"
      @update:model-value="
        consonantPreviewValue.setPreviewValue(parseFloat($event))
      "
      @change="changeValue(parseFloat($event), 'consonant')"
      @wheel="changeValueByScroll($event.deltaY, $event.ctrlKey, 'consonant')"
      @pan="setPanning($event, 'consonant')"
    />
    <!-- vowel -->
    <q-slider
      @mouseenter="handleMouseHover('vowel', true)"
      @mouseleave="handleMouseHover('vowel', false)"
      vertical
      reverse
      snap
      :min="min"
      :max="max"
      :step="step"
      :disable="uiLocked"
      style="clip-path: inset(-50% -50% -50% 50%)"
      :model-value="vowelPreviewValue.currentValue.value"
      @update:model-value="
        vowelPreviewValue.setPreviewValue(parseFloat($event))
      "
      @change="changeValue(parseFloat($event), 'vowel')"
      @wheel="changeValueByScroll($event.deltaY, $event.ctrlKey, 'vowel')"
      @pan="setPanning($event, 'vowel')"
    />
  </div>
  <!-- when it's vowel only -->
  <div v-else>
    <q-badge
      class="value-label"
      text-color="secondary"
      v-if="valueLabel.vowel_visible || valueLabel.vowel_panning"
    >
      {{ vowelPreviewValue.currentValue.value.toPrecision(2) }}
    </q-badge>
    <q-slider
      @mouseenter="handleMouseHover('vowel', true)"
      @mouseleave="handleMouseHover('vowel', false)"
      vertical
      reverse
      snap
      :min="min"
      :max="max"
      :step="step"
      :disable="uiLocked"
      :model-value="vowelPreviewValue.currentValue.value"
      @update:model-value="
        vowelPreviewValue.setPreviewValue(parseFloat($event))
      "
      @change="changeValue(parseFloat($event), 'vowel')"
      @wheel="changeValueByScroll($event.deltaY, $event.ctrlKey, 'vowel')"
      @pan="setPanning($event, 'vowel')"
    />
  </div>
</template>

<script lang="ts">
import { PreviewableValue } from "@/helpers/previewableValue";
import { defineComponent, onMounted, onUnmounted, reactive } from "vue";

export default defineComponent({
  name: "toFixed",

  props: {
    consonant: { type: Number, required: false },
    vowel: { type: Number, required: true },
    accentPhraseIndex: { type: Number, required: true },
    moraIndex: { type: Number, required: true },
    uiLocked: { type: Boolean, required: true },
    min: { type: Number, default: 0.0 },
    max: { type: Number, default: 10.0 },
    step: { type: Number, default: 0.01 },
    isPause: { type: Boolean, default: false },
  },
  emits: ["changeValue", "mouseOver"],

  setup(props, { emit }) {
    // detect shift key and set flag, preventing changes in intonation while scrolling around
    let shiftKeyFlag = false;

    function handleKeyPress(event: KeyboardEvent) {
      if (event.key === "Shift") shiftKeyFlag = false;
    }

    function setShiftKeyFlag(event: KeyboardEvent) {
      if (event.shiftKey) shiftKeyFlag = true;
    }

    onMounted(() => {
      window.addEventListener("keyup", handleKeyPress);
      window.addEventListener("keydown", setShiftKeyFlag);
    });

    onUnmounted(() => {
      window.removeEventListener("keyup", handleKeyPress);
      window.removeEventListener("keydown", setShiftKeyFlag);
    });

    const consonantPreviewValue = new PreviewableValue(() => props.consonant);
    const vowelPreviewValue = new PreviewableValue(() => props.vowel);

    const changeValue = (newValue: number, type: string) => {
      if (props.isPause) {
        type = "pause";
      }
      emit(
        "changeValue",
        props.accentPhraseIndex,
        props.moraIndex,
        newValue,
        type
      );
    };

    const changeValueByScroll = (
      deltaY: number,
      withDetailedStep: boolean,
      type: string
    ) => {
      const step = withDetailedStep ? props.step / 10 : props.step;
      let newValue = 0;
      switch (type) {
        case "consonant": {
          newValue = props.consonant! - (deltaY > 0 ? step : -step);
          break;
        }
        case "vowel": {
          newValue = props.vowel - (deltaY > 0 ? step : -step);
          break;
        }
      }
      newValue = Math.round(newValue * 1e3) / 1e3;
      newValue = newValue > props.min ? newValue : props.min;
      newValue = newValue < props.max ? newValue : props.max;
      if (!props.uiLocked && !shiftKeyFlag && props.max >= newValue)
        changeValue(newValue, type);
    };

    const valueLabel = reactive({
      consonant_visible: false,
      consonant_panning: false,
      vowel_visible: false,
      vowel_panning: false,
    });

    const setPanning = (panningPhase: string, type: string) => {
      switch (type) {
        case "consonant": {
          if (panningPhase === "start") {
            valueLabel.consonant_panning = true;
            consonantPreviewValue.startPreview();
          } else {
            valueLabel.consonant_panning = false;
            consonantPreviewValue.stopPreview();
          }
          break;
        }
        case "vowel": {
          if (panningPhase === "start") {
            valueLabel.vowel_panning = true;
            vowelPreviewValue.startPreview();
          } else {
            valueLabel.vowel_panning = false;
            vowelPreviewValue.stopPreview();
          }
          break;
        }
      }
    };

    const handleMouseHover = (phoneme: string, isOver: boolean) => {
      emit(
        "mouseOver",
        isOver,
        phoneme,
        props.accentPhraseIndex,
        props.moraIndex
      );
      switch (phoneme) {
        case "consonant":
          valueLabel.consonant_visible = isOver;
          break;
        case "pause":
        case "vowel":
          valueLabel.vowel_visible = isOver;
          break;
      }
    };

    return {
      consonantPreviewValue,
      vowelPreviewValue,
      changeValue,
      changeValueByScroll,
      setPanning,
      valueLabel,
      handleMouseHover,
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
