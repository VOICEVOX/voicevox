<!--
  エンジンのアップデート通知ダイアログのコンテナ。
  ダウンロード式のデフォルトエンジンについて、スキップしたバージョンより新しいバージョンがあれば、ダイアログを表示する。
-->

<template>
  <UpdateNotificationDialog
    v-if="newUpdateResult.status == 'updateAvailable'"
    v-model:dialogOpened="dialogOpened"
    title="エンジンアップデートのお知らせ"
    description="「エンジンの管理」から最新バージョンにアップデートできます。"
    updateButtonLabel="エンジンの管理を開く"
    :latestVersion="newUpdateResult.latestVersion"
    :newUpdateInfos="newUpdateResult.newUpdateInfos"
    @skipThisVersionClick="handleSkipThisVersionClick"
    @updateClick="handleUpdateClick"
  />
</template>

<script setup lang="ts">
import semver from "semver";
import { computed, watchEffect } from "vue";
import UpdateNotificationDialog from "./Presentation.vue";
import { useFetchNewUpdateInfos } from "@/composables/useFetchNewUpdateInfos";
import { useStore } from "@/store";
import type { EngineId } from "@/type/preload";

const dialogOpened = defineModel<boolean>("dialogOpened");
const props = defineProps<{
  downloadableDefaultEngineId: EngineId;
  canOpenDialog: boolean; // ダイアログを開いても良いかどうか
}>();

const store = useStore();

const engineInfo = computed(
  () => store.state.engineInfos[props.downloadableDefaultEngineId],
);

// エンジンのバージョンとスキップしたバージョンのうち、新しい方を返す
const currentVersionGetter = () => {
  const engineVersion = engineInfo.value.version;

  const skipEngineUpdateVersion =
    store.state.skipEngineUpdateVersion ?? "0.0.0";
  if (semver.valid(skipEngineUpdateVersion) == undefined) {
    throw new Error(
      `skipEngineUpdateVersionが不正です: ${skipEngineUpdateVersion}`,
    );
  }

  return semver.gt(engineVersion, skipEngineUpdateVersion)
    ? engineVersion
    : skipEngineUpdateVersion;
};

// 新しいバージョンがあれば取得
const newUpdateResult = useFetchNewUpdateInfos(currentVersionGetter, () =>
  window.backend.getEnginePackageUpdateInfosUrl(
    props.downloadableDefaultEngineId,
  ),
);

// 新しいバージョンのアップデートがスキップされたときの処理
const handleSkipThisVersionClick = (version: string) => {
  void store.actions.SET_ROOT_MISC_SETTING({
    key: "skipEngineUpdateVersion",
    value: version,
  });
};

// アップデートが選ばれたときの処理
const handleUpdateClick = () => {
  void store.actions.CHECK_EDITED_AND_NOT_SAVE({
    nextAction: "switchToWelcome",
  });
};

// ダイアログを開くかどうか
// ダイアログを開ける状態、かつ新しいアップデートがある場合にダイアログを開く
const stopWatchEffect = watchEffect(() => {
  if (
    props.canOpenDialog &&
    newUpdateResult.value.status == "updateAvailable"
  ) {
    dialogOpened.value = true;
    stopWatchEffect(); // ダイアログを開く処理は一度だけしか実行しないようにする
  }
});
</script>
