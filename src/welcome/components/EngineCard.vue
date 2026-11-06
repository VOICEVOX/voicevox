<template>
  <section class="engine-card">
    <div class="engine-card-head">
      <div class="engine-name">{{ engineState.embeddedInfo.engineName }}</div>
      <div class="engine-status">
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
      :modelValue="cardState.selectedRuntimeTarget"
      :disabled="cardState.status !== 'idle'"
      @update:modelValue="handleRuntimeTargetChange"
    />
    <div v-if="cardState.type !== 'loading'" class="engine-actions">
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
          v-if="cardState.type === 'fetched'"
          :label="cardState.installationButton.label"
          :disabled="cardState.installationButton.disabled"
          :variant="cardState.installationButton.variant"
          @click="handleInstallEngine"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import semver from "semver";
import { computed, ref } from "vue";
import EngineRuntimeTargetSelect from "./EngineRuntimeTargetSelect.vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import type {
  PackageInfo,
  RuntimeTarget,
} from "@/domain/defaultEngine/latestDefaultEngine";
import { sizeToHumanReadable } from "@/helpers/sizeHelper";
import { assertNonNullable } from "@/type/utility";
import type { EngineId } from "@/type/preload";
import { useStore } from "@/welcome/store";
import type {
  EnginePackageCurrentInfo,
  EnginePackageLatestInfo,
} from "@/domain/enginePackage";
import { showErrorDialog } from "@/components/Dialog/Dialog";

type InstallationButton = {
  label: string;
  variant: "primary" | "default";
  disabled: boolean;
};

/** カードの表示状態。`type`は最新情報の取得状況、`status`はインストールの進捗を表す。 */
type EngineCardState =
  | { type: "loading" }
  | ({
      type: "fetched";
      availableRuntimeTargets: EnginePackageLatestInfo["availableRuntimeTargets"];
      selectedRuntimeTarget: RuntimeTarget;
      installationButton: InstallationButton;
    } & (
      | { status: "idle"; latestInfoMessage: string }
      | { status: "download" | "install"; progress: number }
    ))
  | { type: "fetchError"; error: unknown };

const props = defineProps<{
  engineId: EngineId;
}>();

const store = useStore();

/**
 * インストール直後かどうか。
 * インストール直後に再インストールを誤って押さないよう、ボタンを無効にするために使う。
 * インストールが成功してからエンジン選択を変えるまでの間だけtrueになる。
 */
const hasJustCompletedInstallation = ref(false);

const engineState = computed(() => store.getEngineState(props.engineId));
const cardState = computed<EngineCardState>(() => {
  const engine = engineState.value;
  const latestInfo = engine.latestInfo;
  if (latestInfo.type === "loading") {
    return { type: "loading" };
  }
  if (latestInfo.type === "fetchError") {
    return { type: "fetchError", error: latestInfo.error };
  }

  const availableRuntimeTargets = latestInfo.info.availableRuntimeTargets;
  const selectedRuntimeTargetInfo = availableRuntimeTargets.find(
    (info) => info.target === latestInfo.selectedRuntimeTarget,
  );
  assertNonNullable(selectedRuntimeTargetInfo);

  const display = createInstallationCardDisplay(
    engine.currentInfo,
    selectedRuntimeTargetInfo.packageInfo,
    hasJustCompletedInstallation.value,
    latestInfo.progress.type !== "idle",
  );
  const fetchedCardData = {
    availableRuntimeTargets,
    selectedRuntimeTarget: latestInfo.selectedRuntimeTarget,
    installationButton: display.installationButton,
  };

  if (latestInfo.progress.type === "idle") {
    return {
      ...fetchedCardData,
      type: "fetched",
      status: "idle",
      latestInfoMessage: display.latestInfoMessage,
    };
  }

  return {
    ...fetchedCardData,
    type: "fetched",
    status: latestInfo.progress.type,
    progress: latestInfo.progress.progress,
  };
});

function createInstallationCardDisplay(
  currentInfo: EnginePackageCurrentInfo,
  packageInfo: PackageInfo,
  hasJustCompletedInstallation: boolean,
  isBusy: boolean,
): { installationButton: InstallationButton; latestInfoMessage: string } {
  const latestVersion = packageInfo.version;
  const humanReadableSize = sizeToHumanReadable(
    packageInfo.files.reduce((acc, file) => acc + file.size, 0),
  );
  if (currentInfo.status === "notInstalled") {
    return {
      installationButton: {
        label: `インストール（${humanReadableSize}）`,
        variant: "primary",
        disabled: isBusy,
      },
      latestInfoMessage: `最新バージョン ${latestVersion} をインストールしてください。`,
    };
  }
  if (semver.lt(currentInfo.installedVersion, latestVersion)) {
    return {
      installationButton: {
        label: `アップデート（${humanReadableSize}）`,
        variant: "primary",
        disabled: isBusy,
      },
      latestInfoMessage: `最新バージョン ${latestVersion} にアップデートできます。`,
    };
  }
  if (hasJustCompletedInstallation) {
    return {
      installationButton: {
        label: "インストール済み",
        variant: "default",
        disabled: true,
      },
      latestInfoMessage: `最新バージョン ${latestVersion} がインストール済みです。`,
    };
  }
  return {
    installationButton: {
      label: `再インストール（${humanReadableSize}）`,
      variant: "default",
      disabled: isBusy,
    },
    latestInfoMessage: `最新バージョン ${latestVersion} がインストール済みです。`,
  };
}

function showErrorDetailDialog(error: unknown) {
  void showErrorDialog("最新情報の取得に失敗しました", error);
}

const handleRuntimeTargetChange = (value: RuntimeTarget) => {
  store.setSelectedRuntimeTarget(props.engineId, value);
  hasJustCompletedInstallation.value = false;
};

const handleInstallEngine = async () => {
  const result = await store.installEngine(props.engineId);
  hasJustCompletedInstallation.value = result === "succeeded";
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

.engine-status {
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
