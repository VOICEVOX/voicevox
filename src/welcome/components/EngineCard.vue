<template>
  <section class="engine-card">
    <div class="engine-card-head">
      <div class="engine-name">{{ engineInfo.embeddedInfo.engineName }}</div>
      <span class="status-pill">
        {{
          engineInfo.currentInfo.status === "notInstalled"
            ? "未インストール"
            : "インストール済み"
        }}</span
      >
    </div>
    <div class="engine-meta">
      <div>最新バージョン：{{ latestVersionText }}</div>
      <div v-if="engineInfo.currentInfo.status === 'installed'">
        インストール済み：{{ engineInfo.currentInfo.installedVersion }}
      </div>
    </div>
    <div v-if="progressInfo.type !== 'idle'" class="engine-progress">
      <div class="engine-progress-label">
        {{ progressInfo.type === "download" ? "ダウンロード" : "インストール" }}
      </div>
      <div class="engine-progress-bar">
        <div
          class="engine-progress-fill"
          :style="{ width: `${progressInfo.progress}%` }"
        ></div>
      </div>
      <div class="engine-progress-value">
        {{ Math.floor(progressInfo.progress) }}%
      </div>
    </div>
    <div class="engine-actions">
      <div class="engine-target-select">
        <BaseSelect
          v-if="latestInfo.type === 'fetched'"
          :disabled="isControlDisabled"
          :modelValue="selectedRuntimeTarget"
          @update:modelValue="handleRuntimeTargetChange"
        >
          <BaseSelectItem
            v-for="targetInfo in latestInfo.info.availableRuntimeTargets"
            :key="targetInfo.target"
            :value="targetInfo.target"
            :label="targetInfo.packageInfo.displayInfo.label"
          />
        </BaseSelect>
      </div>
      <div v-if="latestInfo.type === 'fetchError'" class="engine-fetch-error">
        <span class="engine-fetch-error-message">
          最新のエンジン情報を取得できませんでした。
        </span>
        <BaseButton
          label="再試行"
          variant="default"
          @click="store.fetchEngineLatestInfo(props.engineId)"
        />
      </div>
      <BaseButton
        :label="currentEngineStatus.actionLabel"
        :disabled="isControlDisabled"
        :variant="currentEngineStatus.color"
        @click="store.installEngine(props.engineId)"
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
import type { RuntimeTarget } from "@/domain/defaultEngine/latestDefaultEngine";
import { sizeToHumanReadable } from "@/helpers/sizeHelper";
import { assertNonNullable, ExhaustiveError } from "@/type/utility";
import type { EngineId } from "@/type/preload";
import { useStore } from "@/welcome/store";
import type { RuntimeTargetInfo } from "@/domain/enginePackage";

const props = defineProps<{
  engineId: EngineId;
}>();

const store = useStore();

const engineInfo = computed(() => store.getEngineInfo(props.engineId));
const latestInfo = computed(() => engineInfo.value.latestInfo);
const selectedRuntimeTarget = computed(() =>
  store.getSelectedRuntimeTarget(props.engineId),
);
const progressInfo = computed(() => store.getEngineProgress(props.engineId));

function findSelectedPackageInfo(
  availableRuntimeTargets: RuntimeTargetInfo[],
  selected: RuntimeTarget,
) {
  const targetInfo = availableRuntimeTargets.find(
    (info) => info.target === selected,
  );
  assertNonNullable(targetInfo);
  return targetInfo.packageInfo;
}

const latestVersionText = computed(() => {
  switch (latestInfo.value.type) {
    case "fetched": {
      return findSelectedPackageInfo(
        latestInfo.value.info.availableRuntimeTargets,
        selectedRuntimeTarget.value,
      ).version;
    }
    case "fetchError":
      return "（取得失敗）";
    case "loading":
      return "（読み込み中）";
    default:
      throw new ExhaustiveError(latestInfo.value);
  }
});

const currentEngineStatus = computed<{
  actionLabel: string;
  color: "default" | "primary";
}>(() => {
  if (latestInfo.value.type !== "fetched") {
    if (engineInfo.value.currentInfo.status === "notInstalled") {
      return {
        actionLabel: "未インストール",
        color: "default",
      };
    }

    return {
      actionLabel: "インストール済み",
      color: "default",
    };
  }

  const selectedPackageInfo = findSelectedPackageInfo(
    latestInfo.value.info.availableRuntimeTargets,
    selectedRuntimeTarget.value,
  );
  const humanReadableSize = sizeToHumanReadable(
    selectedPackageInfo.files.reduce((acc, file) => acc + file.size, 0),
  );
  if (engineInfo.value.currentInfo.status === "notInstalled") {
    return {
      actionLabel: `インストール（${humanReadableSize}）`,
      color: "primary",
    };
  }
  const isOutdated = semver.lt(
    engineInfo.value.currentInfo.installedVersion,
    selectedPackageInfo.version,
  );
  if (isOutdated) {
    return {
      actionLabel: `アップデート（${humanReadableSize}）`,
      color: "primary",
    };
  }
  return {
    actionLabel: `再インストール（${humanReadableSize}）`,
    color: "default",
  };
});

const isControlDisabled = computed(() => {
  return (
    progressInfo.value.type !== "idle" || latestInfo.value.type !== "fetched"
  );
});

const handleRuntimeTargetChange = (value: RuntimeTarget | undefined) => {
  assertNonNullable(value);
  store.setSelectedRuntimeTarget(props.engineId, value);
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
