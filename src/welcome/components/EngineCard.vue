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
      <div v-if="localInfo.installed.status === 'installed'">
        インストール済み：{{ localInfo.installed.installedVersion }}
      </div>
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
        :label="actionLabelWithSize"
        :disabled="actionDisabled"
        :variant="actionVariant"
        @click="emitInstall"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import semver from "semver";
import { computed } from "vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseSelect from "@/components/Base/BaseSelect.vue";
import BaseSelectItem from "@/components/Base/BaseSelectItem.vue";
import type {
  EnginePackageLocalInfo,
  EnginePackageRemoteInfo,
} from "@/backend/electron/engineAndVvppController";
import type { RuntimeTarget } from "@/domain/defaultEngine/latetDefaultEngine";

import { ExhaustiveError } from "@/type/utility";
import { sizeToHumanReadable } from "@/helpers/sizeHelper";

type DisplayStatus = "notInstalled" | "installed" | "outdated" | "latest";
type EngineProgressInfo = {
  progress: number;
  type: "download" | "install";
};
type RuntimeTargetOption = {
  target: RuntimeTarget;
  label: string;
  hint?: string;
};
type RuntimeTargetInfo =
  EnginePackageRemoteInfo["availableRuntimeTargets"][number];

const props = defineProps<{
  engineName: string;
  localInfo: EnginePackageLocalInfo;
  remoteInfo?: EnginePackageRemoteInfo;
  selectedRuntimeTarget?: RuntimeTarget;
  runtimeSelectDisabled: boolean;
  progressInfo?: EngineProgressInfo;
}>();

const emit = defineEmits<{
  selectRuntimeTarget: [target: RuntimeTarget];
  installEngine: [];
}>();

const availableRuntimeTargets = computed(() => {
  return props.remoteInfo?.availableRuntimeTargets ?? [];
});

const runtimeTargetOptions = computed<RuntimeTargetOption[]>(() =>
  availableRuntimeTargets.value.map((targetInfo) => {
    const label = targetInfo.packageInfo.displayInfo.label;
    return {
      target: targetInfo.target,
      label,

      // TODO: ヒントを表示するUIを追加する
      hint: targetInfo.packageInfo.displayInfo.hint,
    };
  }),
);

const getPackageInfoForTarget = (
  target: RuntimeTarget | undefined,
): RuntimeTargetInfo["packageInfo"] | undefined => {
  if (!target) {
    return undefined;
  }
  return availableRuntimeTargets.value.find(
    (targetInfo) => targetInfo.target === target,
  )?.packageInfo;
};

const selectedPackageInfo = computed(() =>
  getPackageInfoForTarget(props.selectedRuntimeTarget),
);

const latestVersionLabel = computed(() =>
  selectedPackageInfo.value
    ? selectedPackageInfo.value.version
    : "（読み込み中）",
);

const engineStatus = computed<DisplayStatus>(() => {
  if (props.localInfo.installed.status === "notInstalled") {
    return "notInstalled";
  }
  if (!selectedPackageInfo.value) {
    return "installed";
  }
  return semver.lt(
    props.localInfo.installed.installedVersion,
    selectedPackageInfo.value.version,
  )
    ? "outdated"
    : "latest";
});

const statusLabel = computed(() => {
  switch (engineStatus.value) {
    case "notInstalled":
      return "未インストール";
    case "installed":
      return "インストール済み";
    case "outdated":
      return "更新あり";
    case "latest":
      return "最新";
    default:
      throw new ExhaustiveError(engineStatus.value);
  }
});

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

const isDownloadingOrInstalling = computed(() => {
  const progress = props.progressInfo?.progress;
  return progress != undefined && progress < 100;
});

const actionLabel = computed(() => {
  if (isDownloadingOrInstalling.value) {
    return "処理中";
  }
  switch (engineStatus.value) {
    case "notInstalled":
      return "インストール";
    case "installed":
      return "インストール済み";
    case "outdated":
      return "更新";
    case "latest":
      return "再インストール";
    default:
      throw new ExhaustiveError(engineStatus.value);
  }
});
const actionLabelWithSize = computed(() => {
  if (isDownloadingOrInstalling.value) {
    return actionLabel.value;
  }

  const size = selectedPackageInfo.value?.files.reduce(
    (acc, file) => acc + file.size,
    0,
  );
  if (size) {
    return `${actionLabel.value}（${sizeToHumanReadable(size)}）`;
  } else {
    return actionLabel.value;
  }
});

const actionVariant = computed<"primary" | "default">(() =>
  engineStatus.value === "notInstalled" || engineStatus.value === "outdated"
    ? "primary"
    : "default",
);

const actionDisabled = computed(() => {
  if (!props.selectedRuntimeTarget) {
    return true;
  }
  return isDownloadingOrInstalling.value;
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
