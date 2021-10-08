<template>
  <div v-if="consonantPreviewValue.currentValue.value !== undefined">
    <!-- consonant -->
    <q-slider
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
    />
    <!-- vowel -->
    <q-slider
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
    />
  </div>
  <div v-else>
    <q-slider
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
    />
  </div>
</template>

<script lang="ts">
import { PreviewableValue } from "@/helpers/previewableValue";
import { defineComponent, onMounted, onUnmounted } from "vue";

export default defineComponent({
  name: "AudioDuration",

  props: {
    consonant: { type: Number, required: false },
    vowel: { type: Number, required: true },
    accentPhraseIndex: { type: Number, required: true },
    moraIndex: { type: Number, required: true },
    uiLocked: { type: Boolean, required: true },
    min: { type: Number, default: 0.0 },
    max: { type: Number, default: 10.0 },
    step: { type: Number, default: 0.01 },
  },
  emits: ["changeValue"],

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
      emit(
        "changeValue",
        props.accentPhraseIndex,
        props.moraIndex,
        newValue,
        type
      );
    };
    return {
      consonantPreviewValue,
      vowelPreviewValue,
      changeValue,
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
