<template>
  <section class="engine-card">
    <div class="engine-card-head">
      <div class="engine-name">{{ engineState.embeddedInfo.engineName }}</div>
      <div class="engine-card-status">
        <span
          v-if="engineState.currentInfo.status === 'installed'"
          class="status-pill"
        >
          バージョン {{ engineState.currentInfo.installedVersion }}
        </span>
        <span class="status-pill">
          {{
            engineState.currentInfo.status === "notInstalled"
              ? "未インストール"
              : "インストール済み"
          }}
        </span>
      </div>
    </div>
    <div v-if="cardState.type === 'loading'" class="engine-meta">
      （読み込み中）
    </div>
    <div
      v-if="cardState.type === 'fetched' && cardState.status === 'idle'"
      class="engine-meta"
    >
      {{ cardState.latestInfoMessage }}
    </div>
    <div
      v-if="cardState.type === 'fetched' && cardState.status !== 'idle'"
      class="engine-progress"
    >
      <div class="engine-progress-label">
        {{ cardState.status === "download" ? "ダウンロード" : "インストール" }}
      </div>
      <div class="engine-progress-bar">
        <div
          class="engine-progress-fill"
          :style="{ width: `${cardState.progress}%` }"
        ></div>
      </div>
      <div class="engine-progress-value">
        {{ Math.floor(cardState.progress) }}%
      </div>
    </div>
    <EngineRuntimeTargetSelect
      v-if="cardState.type === 'fetched'"
      :engineId="props.engineId"
      :availableRuntimeTargets="cardState.availableRuntimeTargets"
      :modelValue="cardState.selected.target"
      :disabled="cardState.status !== 'idle'"
      @update:modelValue="handleRuntimeTargetChange"
    />
    <div class="engine-actions">
      <div v-if="cardState.type === 'fetchError'" class="engine-fetch-error">
        最新情報の取得に失敗しました。
      </div>
      <div class="engine-action-buttons">
        <BaseButton
          v-if="cardState.type === 'fetchError'"
          label="エラー詳細"
          variant="default"
          @click="showErrorDetailDialog(cardState.error)"
        />
        <BaseButton
          v-if="cardState.type === 'fetchError'"
          label="再試行"
          variant="default"
          @click="store.fetchEngineLatestInfo(props.engineId)"
        />
        <BaseButton
          :label="cardState.action.label"
          :disabled="
            cardState.type !== 'fetched' ||
            cardState.status !== 'idle' ||
            cardState.action.type === 'completed'
          "
          :variant="cardState.action.variant"
          @click="store.installEngine(props.engineId)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import semver from "semver";
import { computed } from "vue";
import EngineRuntimeTargetSelect from "./EngineRuntimeTargetSelect.vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import type {
  PackageInfo,
  RuntimeTarget,
} from "@/domain/defaultEngine/latestDefaultEngine";
import { sizeToHumanReadable } from "@/helpers/sizeHelper";
import { assertNonNullable, ExhaustiveError } from "@/type/utility";
import type { EngineId } from "@/type/preload";
import { useStore } from "@/welcome/store";
import type {
  EnginePackageCurrentInfo,
  EnginePackageLatestInfo,
} from "@/domain/enginePackage";
import { showErrorDialog } from "@/components/Dialog/Dialog";

type EngineCardAction =
  | { type: "install" | "update"; label: string; variant: "primary" }
  | { type: "reinstall"; label: string; variant: "default" }
  | { type: "completed"; label: "インストール済み"; variant: "default" };

type UnavailableAction = {
  type: "unavailable";
  label: "未インストール" | "インストール済み";
  variant: "default";
};

type AvailableCardData = {
  availableRuntimeTargets: EnginePackageLatestInfo["availableRuntimeTargets"];
  selected: EnginePackageLatestInfo["availableRuntimeTargets"][number];
  action: EngineCardAction;
};

type EngineCardState =
  | { type: "loading"; action: UnavailableAction }
  | { type: "fetchError"; error: unknown; action: UnavailableAction }
  | (AvailableCardData & { type: "fetched" } & (
        | { status: "idle"; latestInfoMessage: string }
        | { status: "download" | "install"; progress: number }
      ));

const props = defineProps<{
  engineId: EngineId;
}>();

const store = useStore();

const engineState = computed(() => store.getEngineState(props.engineId));
const cardState = computed<EngineCardState>(() => {
  const engine = engineState.value;
  const latestInfo = engine.latestInfo;
  if (latestInfo.type === "loading" || latestInfo.type === "fetchError") {
    const action: UnavailableAction = {
      type: "unavailable",
      label:
        engine.currentInfo.status === "notInstalled"
          ? "未インストール"
          : "インストール済み",
      variant: "default",
    };
    if (latestInfo.type === "loading") {
      return { type: "loading", action };
    }
    return { type: "fetchError", error: latestInfo.error, action };
  }

  const availableRuntimeTargets = latestInfo.info.availableRuntimeTargets;
  const selected = availableRuntimeTargets.find(
    (info) => info.target === latestInfo.selectedRuntimeTarget,
  );
  assertNonNullable(selected);

  const actionType = getInstallationActionType(
    engine.currentInfo,
    selected.packageInfo,
    engine.hasJustCompletedInstallation,
  );
  const action = createEngineCardAction(actionType, selected.packageInfo);
  const availableCardData: AvailableCardData = {
    availableRuntimeTargets,
    selected,
    action,
  };

  if (latestInfo.progress.type === "idle") {
    const latestVersion = selected.packageInfo.version;
    let latestInfoMessage: string;
    switch (action.type) {
      case "install":
        latestInfoMessage = `最新バージョン ${latestVersion} をインストールしてください。`;
        break;
      case "update":
        latestInfoMessage = `最新バージョン ${latestVersion} にアップデートできます。`;
        break;
      case "reinstall":
      case "completed":
        latestInfoMessage = `最新バージョン ${latestVersion} がインストール済みです。`;
        break;
      default:
        throw new ExhaustiveError(action);
    }
    return {
      ...availableCardData,
      type: "fetched",
      status: "idle",
      latestInfoMessage,
    };
  }

  return {
    ...availableCardData,
    type: "fetched",
    status: latestInfo.progress.type,
    progress: latestInfo.progress.progress,
  };
});

function getInstallationActionType(
  currentInfo: EnginePackageCurrentInfo,
  packageInfo: PackageInfo,
  hasJustCompletedInstallation: boolean,
): EngineCardAction["type"] {
  if (currentInfo.status === "notInstalled") {
    return "install";
  }
  if (semver.lt(currentInfo.installedVersion, packageInfo.version)) {
    return "update";
  }
  if (hasJustCompletedInstallation) {
    return "completed";
  }
  return "reinstall";
}

function createEngineCardAction(
  type: EngineCardAction["type"],
  packageInfo: PackageInfo,
): EngineCardAction {
  if (type === "completed") {
    return { type: "completed", label: "インストール済み", variant: "default" };
  }

  const humanReadableSize = sizeToHumanReadable(
    packageInfo.files.reduce((acc, file) => acc + file.size, 0),
  );
  switch (type) {
    case "install":
      return {
        type: "install",
        label: `インストール（${humanReadableSize}）`,
        variant: "primary",
      };
    case "update":
      return {
        type: "update",
        label: `アップデート（${humanReadableSize}）`,
        variant: "primary",
      };
    case "reinstall":
      return {
        type: "reinstall",
        label: `再インストール（${humanReadableSize}）`,
        variant: "default",
      };
    default:
      throw new ExhaustiveError(type);
  }
}

function showErrorDetailDialog(error: unknown): void {
  void showErrorDialog("最新情報の取得に失敗しました", error);
}

const handleRuntimeTargetChange = (value: RuntimeTarget): void => {
  store.setSelectedRuntimeTarget(props.engineId, value);
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;
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
  @include mixin.headline-3;
}

.engine-card-status {
  display: flex;
  gap: vars.$gap-1;
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

.engine-action-buttons {
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
}

.engine-fetch-error {
  font-size: 0.75rem;
  color: colors.$display-warning;
}
</style>
