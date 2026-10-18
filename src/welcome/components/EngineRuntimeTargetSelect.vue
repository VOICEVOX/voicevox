<template>
  <fieldset class="engine-runtime-target-select">
    <legend>インストールするエンジン</legend>
    <div class="options">
      <label
        v-for="targetInfo in availableRuntimeTargets"
        :key="targetInfo.target"
        class="option"
        :class="{
          'option-selected': modelValue === targetInfo.target,
          'option-disabled': disabled,
        }"
      >
        <input
          class="option-radio"
          type="radio"
          :name="engineId"
          :value="targetInfo.target"
          :checked="modelValue === targetInfo.target"
          :disabled="disabled"
          @change="emit('update:modelValue', targetInfo.target)"
        />
        <span class="option-content">
          <span class="option-indicator" aria-hidden="true">
            <QIcon
              v-if="modelValue === targetInfo.target"
              class="option-check"
              name="check"
            />
          </span>
          <span class="option-text">
            <span class="option-label">
              {{ targetInfo.packageInfo.displayInfo.label }}
            </span>
            <span class="option-hint">
              {{ targetInfo.packageInfo.displayInfo.hint }}
            </span>
          </span>
        </span>
      </label>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import type { RuntimeTarget } from "@/domain/defaultEngine/latestDefaultEngine";
import type { EnginePackageLatestInfo } from "@/domain/enginePackage";
import type { EngineId } from "@/type/preload";

defineProps<{
  engineId: EngineId;
  availableRuntimeTargets: EnginePackageLatestInfo["availableRuntimeTargets"];
  modelValue: RuntimeTarget;
  disabled: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [target: RuntimeTarget];
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

.engine-runtime-target-select {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: vars.$gap-1;
  margin: 0;
  padding: 0;
  border: 0;
  color: colors.$display;
}

legend {
  padding: 0;
  font-weight: bold;
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: vars.$gap-1;
  margin-top: vars.$gap-1;
}

.option {
  position: relative;
  display: flex;
  flex: 1 1 12rem;
  min-width: 0;
  padding: vars.$padding-2;
  border: 1px solid colors.$border;
  border-radius: vars.$radius-1;
  background-color: colors.$control;
  color: colors.$display;
  text-align: start;
  cursor: pointer;

  &:not(.option-selected):hover:not(.option-disabled) {
    background-color: colors.$control-hovered;
  }

  &:not(.option-selected):active:not(.option-disabled) {
    background-color: colors.$control-pressed;
  }

  &:focus-within {
    @include mixin.on-focus;
    outline-offset: -2px;
  }
}

.option-selected {
  background-color: colors.$selected;
}

.option-disabled {
  opacity: 0.5;
  cursor: default;
}

.option-radio {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.option-content {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: vars.$gap-1;
}

.option-indicator {
  display: grid;
  flex: 0 0 vars.$size-icon;
  min-height: vars.$size-icon;
  place-items: center;
}

.option-check {
  width: vars.$size-icon;
  height: vars.$size-icon;
}

.option-text {
  display: grid;
  min-width: 0;
}

.option-label {
  font-weight: 600;
}

.option-hint {
  color: colors.$display-sub;
  font-size: 0.8rem;
}
</style>
