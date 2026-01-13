<template>
  <section class="engine-card">
    <div class="engine-card-head">
      <div class="engine-name">{{ engineName }}</div>
      <span class="status-pill" :data-status="engineStatus">{{
        statusLabel
      }}</span>
    </div>
    <div class="engine-meta">
      <div>最新バージョン：{{ latestVersionLabel }}</div>
      <div>インストール済み：{{ installedVersionLabel }}</div>
    </div>
    <div v-if="progressInfo" class="engine-progress">
      <div class="engine-progress-label">{{ progressTypeLabel }}</div>
      <div class="engine-progress-bar">
        <div
          class="engine-progress-fill"
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
      <div class="engine-progress-value">{{ progressPercentage }}%</div>
    </div>
    <div class="engine-actions">
      <div class="engine-target-select">
        <BaseSelect
          :disabled="runtimeSelectDisabled"
          :modelValue="selectedRuntimeTarget"
          placeholder="ターゲットを選択"
          @update:modelValue="handleRuntimeTargetChange"
        >
          <BaseSelectItem
            v-for="targetOption in runtimeTargetOptions"
            :key="targetOption.target"
            :value="targetOption.target"
            :label="targetOption.label"
          />
        </BaseSelect>
      </div>
      <BaseButton
        :label="actionLabel"
        :disabled="actionDisabled"
        :variant="actionVariant"
        @click="emitInstall"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseSelect from "@/components/Base/BaseSelect.vue";
import BaseSelectItem from "@/components/Base/BaseSelectItem.vue";
import type { RuntimeTarget } from "@/domain/defaultEngine/latetDefaultEngine";

type DisplayStatus = "notInstalled" | "installed" | "outdated" | "latest";
type EngineProgressInfo = {
  progress: number;
  type: "download" | "install";
};

type RuntimeTargetOption = {
  target: RuntimeTarget;
  label: string;
};

const props = defineProps<{
  engineName: string;
  latestVersionLabel: string;
  installedVersionLabel: string;
  engineStatus: DisplayStatus;
  statusLabel: string;
  runtimeTargetOptions: RuntimeTargetOption[];
  selectedRuntimeTarget?: RuntimeTarget;
  runtimeSelectDisabled: boolean;
  progressInfo?: EngineProgressInfo;
  actionLabel: string;
  actionVariant: "primary" | "default";
  actionDisabled: boolean;
}>();

const emit = defineEmits<{
  selectRuntimeTarget: [target: RuntimeTarget];
  installEngine: [];
}>();

const progressTypeLabel = computed(() => {
  if (!props.progressInfo) {
    return "";
  }
  return props.progressInfo.type === "download"
    ? "ダウンロード"
    : "インストール";
});

const progressPercentage = computed(() => {
  if (!props.progressInfo) {
    return 0;
  }
  return Math.floor(props.progressInfo.progress);
});

const handleRuntimeTargetChange = (value: RuntimeTarget | undefined) => {
  if (value) {
    emit("selectRuntimeTarget", value);
  }
};

const emitInstall = () => {
  emit("installEngine");
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/variables" as vars;
@use "@/styles/colors" as colors_v1;

.engine-card {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
  padding: vars.$padding-2;
  border-radius: vars.$radius-2;
  border: 1px solid colors.$border;
  background-color: colors.$surface;
}

.engine-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: vars.$gap-1;
}

.engine-name {
  font-weight: 700;
}

.status-pill {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  border: 1px solid colors.$border;
  background-color: colors.$control;
  color: colors.$display-sub;
}

.status-pill[data-status="latest"] {
  background-color: colors.$primary;
  color: colors.$display-oncolor;
  border-color: transparent;
}

.status-pill[data-status="outdated"] {
  background-color: colors.$warning;
  color: colors.$display-warning;
  border-color: colors.$display-warning;
}

.engine-meta {
  display: grid;
  gap: 4px;
  color: colors.$display;
}

.engine-progress {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: vars.$gap-1;
  color: colors.$display;
}

.engine-progress-bar {
  position: relative;
  height: 0.5em;
  border-radius: 999px;
  background-color: colors_v1.$surface;
  overflow: hidden;
}

.engine-progress-fill {
  position: absolute;
  inset: 0;
  background-color: colors.$primary;
  transition: width 180ms ease;
}

.engine-progress-value {
  font-weight: 600;
}

.engine-progress-label {
  font-size: 0.75rem;
  color: colors.$display-sub;
}

.engine-actions {
  display: flex;
  justify-content: flex-end;
  gap: vars.$gap-1;
}
</style>
