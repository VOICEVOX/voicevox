<template>
  <section class="engine-card">
    <div class="engine-card-head">
      <div class="engine-name">{{ engineName }}</div>
      <span class="status-pill">{{
        props.currentInfo.installed.status === "notInstalled"
          ? "未インストール"
          : "インストール済み"
      }}</span>
    </div>
    <div class="engine-meta">
      <div>最新バージョン：{{ latestVersionLabel }}</div>
      <div v-if="currentInfo.installed.status === 'installed'">
        インストール済み：{{ currentInfo.installed.installedVersion }}
      </div>
    </div>
    <div
      v-if="
        props.remoteInfo.type === 'fetched' &&
        props.remoteInfo.progressInfo.type !== 'idle'
      "
      class="engine-progress"
    >
      <div class="engine-progress-label">
        {{
          props.remoteInfo.progressInfo.type === "download"
            ? "ダウンロード"
            : "インストール"
        }}
      </div>
      <div class="engine-progress-bar">
        <div
          class="engine-progress-fill"
          :style="{ width: `${props.remoteInfo.progressInfo.progress}%` }"
        ></div>
      </div>
      <div class="engine-progress-value">
        {{ Math.floor(props.remoteInfo.progressInfo.progress) }}%
      </div>
    </div>
    <div class="engine-actions">
      <div class="engine-target-select">
        <BaseSelect
          v-if="remoteInfo.type === 'fetched'"
          :disabled="isDownloadingOrInstalling"
          :modelValue="remoteInfo.selectedRuntimeTarget"
          @update:modelValue="handleRuntimeTargetChange"
        >
          <BaseSelectItem
            v-for="targetOption in computeRuntimeTargetOptions(
              remoteInfo.latestInfo.availableRuntimeTargets,
            )"
            :key="targetOption.target"
            :value="targetOption.target"
            :label="targetOption.label"
          />
        </BaseSelect>
      </div>
      <div v-if="remoteInfo.type === 'fetchError'" class="engine-fetch-error">
        <span class="engine-fetch-error-message">{{ remoteInfo.message }}</span>
        <BaseButton
          label="再試行"
          variant="default"
          @click="emit('retryFetchRemoteInfo')"
        />
      </div>
      <BaseButton
        :label="currentEngineStatus.actionLabel"
        :disabled="isInstallButtonDisabled"
        :variant="currentEngineStatus.color"
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
  EnginePackageCurrentInfo,
  EnginePackageLatestInfo,
} from "@/domain/enginePackage";
import type { RuntimeTarget } from "@/domain/defaultEngine/latestDefaultEngine";
import { sizeToHumanReadable } from "@/helpers/sizeHelper";
import { assertNonNullable, ExhaustiveError } from "@/type/utility";

type RuntimeTargetOption = {
  target: RuntimeTarget;
  label: string;
  hint?: string;
};

type RuntimeTargetInfo =
  EnginePackageLatestInfo["availableRuntimeTargets"][number];

const props = defineProps<{
  engineName: string;
  currentInfo: EnginePackageCurrentInfo;
  remoteInfo:
    | {
        type: "loading";
      }
    | {
        type: "fetched";
        latestInfo: EnginePackageLatestInfo;
        selectedRuntimeTarget: RuntimeTarget;
        progressInfo:
          | {
              type: "idle";
            }
          | {
              type: "download" | "install";
              progress: number;
            };
      }
    | {
        type: "fetchError";
        message: string;
      };
}>();

const emit = defineEmits<{
  selectRuntimeTarget: [target: RuntimeTarget];
  installEngine: [];
  retryFetchRemoteInfo: [];
}>();

function computeRuntimeTargetOptions(
  availableRuntimeTargets: RuntimeTargetInfo[],
): RuntimeTargetOption[] {
  return availableRuntimeTargets.map((targetInfo) => {
    const label = targetInfo.packageInfo.displayInfo.label;
    return {
      target: targetInfo.target,
      label,
      hint: targetInfo.packageInfo.displayInfo.hint,
    };
  });
}

function findSelectedPackageInfo(
  availableRuntimeTargets: RuntimeTargetInfo[],
  selectedRuntimeTarget: RuntimeTarget,
) {
  const targetInfo = availableRuntimeTargets.find(
    (info) => info.target === selectedRuntimeTarget,
  );
  assertNonNullable(targetInfo);
  return targetInfo.packageInfo;
}

const latestVersionLabel = computed(() => {
  switch (props.remoteInfo.type) {
    case "fetched":
      return findSelectedPackageInfo(
        props.remoteInfo.latestInfo.availableRuntimeTargets,
        props.remoteInfo.selectedRuntimeTarget,
      ).version;
    case "fetchError":
      return "（取得失敗）";
    case "loading":
      return "（読み込み中）";
    default:
      throw new ExhaustiveError(props.remoteInfo);
  }
});

const currentEngineStatus = computed<{
  type: "notInstalled" | "installed" | "outdated" | "latest";
  actionLabel: string;
  color: "default" | "primary";
}>(() => {
  if (props.currentInfo.installed.status === "notInstalled") {
    return {
      type: "notInstalled",
      actionLabel: "未インストール",
      color: "default",
    };
  }
  if (props.remoteInfo.type !== "fetched") {
    return {
      type: "installed",
      actionLabel: "インストール済み",
      color: "default",
    };
  }

  const selectedPackageInfo = findSelectedPackageInfo(
    props.remoteInfo.latestInfo.availableRuntimeTargets,
    props.remoteInfo.selectedRuntimeTarget,
  );
  const humanReadableSize = sizeToHumanReadable(
    selectedPackageInfo.files.reduce((acc, file) => acc + file.size, 0),
  );
  const isOutdated = semver.lt(
    props.currentInfo.installed.installedVersion,
    selectedPackageInfo.version,
  );
  if (isOutdated) {
    return {
      type: "outdated",
      actionLabel: `アップデート（${humanReadableSize}）`,
      color: "primary",
    };
  }
  return {
    type: "latest",
    actionLabel: `再インストール（${humanReadableSize}）`,
    color: "default",
  };
});

const isDownloadingOrInstalling = computed(() => {
  return (
    props.remoteInfo.type === "fetched" &&
    props.remoteInfo.progressInfo.type !== "idle"
  );
});

const isInstallButtonDisabled = computed(() => {
  return isDownloadingOrInstalling.value || props.remoteInfo.type !== "fetched";
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
  align-items: center;
  justify-content: flex-end;
  gap: vars.$gap-1;
  flex-wrap: wrap;
}

.engine-fetch-error {
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
}

.engine-fetch-error-message {
  font-size: 0.75rem;
  color: colors.$display-warning;
}
</style>
