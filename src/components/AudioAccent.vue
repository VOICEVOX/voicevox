<template>
  <div
    class="accent-slider-cell"
    :style="{
      'grid-column': `1 / span ${accentPhrase.moras.length * 2 - 1}`,
    }"
  >
    <!-- div for input width -->
    <div>
      <div>
        <q-slider
          v-if="accentPhrase.moras.length > 1"
          snap
          dense
          :min="previewAccentSlider.qSliderProps.min.value"
          :max="previewAccentSlider.qSliderProps.max.value"
          :step="previewAccentSlider.qSliderProps.step.value"
          :disable="previewAccentSlider.qSliderProps.disable.value"
          :model-value="previewAccentSlider.qSliderProps.modelValue.value"
          @update:model-value="
            previewAccentSlider.qSliderProps['onUpdate:modelValue']
          "
          @change="previewAccentSlider.qSliderProps.onChange"
          @wheel="previewAccentSlider.qSliderProps.onWheel"
          @pan="previewAccentSlider.qSliderProps.onPan"
        />
      </div>
    </div>
  </div>
  <div
    class="accent-draw-cell"
    :style="{
      'grid-column': `1 / span ${accentPhrase.moras.length * 2 - 1}`,
    }"
  >
    <svg :viewBox="`0 0 ${accentPhrase.moras.length * 40 - 10} 50`">
      <polyline :points="accentLine" stroke="black" fill="none" />
    </svg>
  </div>
  <template v-for="(mora, moraIndex) in accentPhrase.moras" :key="moraIndex">
    <div
      @click="uiLocked || changeAccent(moraIndex + 1)"
      :class="[
        'accent-select-cell',
        {
          'accent-select-cell-selected':
            previewAccentSlider.state.currentValue.value == moraIndex + 1,
        },
      ]"
      :style="{ 'grid-column': `${moraIndex * 2 + 1} / span 1` }"
    >
      <svg width="29" height="50" viewBox="0 0 29 50">
        <line x1="14" y1="0" x2="14" y2="50" stroke-width="1" />
      </svg>
    </div>
  </template>
</template>

<script lang="ts">
import { previewSliderHelper } from "@/helpers/previewSliderHelper";
import { AccentPhrase } from "@/openapi";
import { defineComponent, computed, PropType } from "vue";

export default defineComponent({
  name: "AudioAccent",

  props: {
    accentPhrase: { type: Object as PropType<AccentPhrase>, required: true },
    accentPhraseIndex: { type: Number, required: true },
    uiLocked: { type: Boolean, required: true },
    shiftKeyFlag: { type: Boolean, default: false },
    onChangeAccent: {
      type: Function as PropType<
        (accentPhraseIndex: number, accent: number) => Promise<void>
      >,
      required: true,
    },
  },

  setup(props) {
    const changeAccent = (accent: number) =>
      props.onChangeAccent(props.accentPhraseIndex, accent);

    const previewAccentSlider = previewSliderHelper({
      onChange: changeAccent,
      modelValue: () => props.accentPhrase.accent,
      disable: () => props.uiLocked,
      max: () => props.accentPhrase.moras.length,
      min: () => 1,
      step: () => 1,
    });

    const accentLine = computed(() => {
      const accent = previewAccentSlider.state.currentValue.value ?? 0;
      return [...Array(props.accentPhrase.moras.length).keys()].map(
        (index) =>
          `${index * 40 + 15} ${
            index + 1 == accent || (index != 0 && index < accent) ? 5 : 45
          }`
      );
    });

    return {
      previewAccentSlider,
      changeAccent,
      accentLine,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles' as global;

div {
  padding: 0px;
  &.accent-slider-cell {
    grid-row-start: 1;
    align-self: flex-end;

    margin-left: 5px;
    margin-right: 10px;
    position: relative;
    > div {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      > div {
        padding-left: 10px;
        padding-right: 5px;
      }
    }
  }
  &.accent-draw-cell {
    grid-row-start: 2;
    svg line {
      stroke: black;
    }
  }
  &.accent-select-cell {
    grid-row-start: 2;
    text-align: center;
    cursor: pointer;
    svg line {
      stroke: global.$primary;
      stroke-dasharray: 3;
    }
  }
  &.accent-select-cell-selected {
    svg line {
      stroke-dasharray: none;
      stroke-width: 3;
    }
  }
}
</style>
