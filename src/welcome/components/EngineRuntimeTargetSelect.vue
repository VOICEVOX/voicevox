<template>
  <fieldset class="engine-runtime-target-select">
    <legend>インストールするエンジン</legend>
    <div class="engine-runtime-target-options">
      <label
        v-for="targetInfo in availableRuntimeTargets"
        :key="targetInfo.target"
        class="engine-runtime-target-option"
        :class="{
          'engine-runtime-target-option-selected':
            modelValue === targetInfo.target,
          'engine-runtime-target-option-disabled': disabled,
        }"
      >
        <input
          class="engine-runtime-target-radio"
          type="radio"
          :name="engineId"
          :value="targetInfo.target"
          :checked="modelValue === targetInfo.target"
          :disabled="disabled"
          @change="emit('update:modelValue', targetInfo.target)"
        />
        <span class="engine-runtime-target-content">
          <span class="engine-runtime-target-indicator" aria-hidden="true">
            <QIcon
              v-if="modelValue === targetInfo.target"
              class="engine-runtime-target-check"
              name="check"
            />
          </span>
          <span class="engine-runtime-target-text">
            <span class="engine-runtime-target-label">
              {{ targetInfo.packageInfo.displayInfo.label }}
            </span>
            <span class="engine-runtime-target-hint">
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

.engine-runtime-target-options {
  display: flex;
  flex-wrap: wrap;
  gap: vars.$gap-1;
  margin-top: vars.$gap-1;
}

.engine-runtime-target-option {
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

  &:not(.engine-runtime-target-option-selected):hover:not(
      .engine-runtime-target-option-disabled
    ) {
    background-color: colors.$control-hovered;
  }

  &:not(.engine-runtime-target-option-selected):active:not(
      .engine-runtime-target-option-disabled
    ) {
    background-color: colors.$control-pressed;
  }

  &:focus-within {
    @include mixin.on-focus;
    outline-offset: -2px;
  }
}

.engine-runtime-target-option-selected {
  background-color: colors.$selected;
}

.engine-runtime-target-option-disabled {
  opacity: 0.5;
  cursor: default;
}

.engine-runtime-target-radio {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.engine-runtime-target-content {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: vars.$gap-1;
}

.engine-runtime-target-indicator {
  display: grid;
  flex: 0 0 vars.$size-icon;
  min-height: vars.$size-icon;
  place-items: center;
}

.engine-runtime-target-check {
  width: vars.$size-icon;
  height: vars.$size-icon;
}

.engine-runtime-target-text {
  display: grid;
  min-width: 0;
}

.engine-runtime-target-label {
  font-weight: 600;
}

.engine-runtime-target-hint {
  color: colors.$display-sub;
  font-size: 0.8rem;
}
</style>
