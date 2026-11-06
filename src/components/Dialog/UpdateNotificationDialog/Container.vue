<!--
  アップデート通知ダイアログのコンテナ。
  スキップしたバージョンより新しいバージョンがあれば、ダイアログを表示する。
-->

<template>
  <UpdateNotificationDialog
    v-if="newUpdateResult.status == 'updateAvailable'"
    v-model:dialogOpened="dialogOpened"
    title="アップデートのお知らせ"
    description="公式サイトから最新バージョンをダウンロードできます。"
    updateButtonLabel="公式サイトを開く"
    :latestVersion="newUpdateResult.latestVersion"
    :newUpdateInfos="newUpdateResult.newUpdateInfos"
    @skipThisVersionClick="handleSkipThisVersionClick"
    @updateClick="handleUpdateClick"
  />
</template>

<script setup lang="ts">
import semver from "semver";
import { watchEffect } from "vue";
import UpdateNotificationDialog from "./Presentation.vue";
import { useFetchNewUpdateInfos } from "@/composables/useFetchNewUpdateInfos";
import { useStore } from "@/store";
import { UrlString } from "@/type/preload";
import { getAppInfos } from "@/domain/appInfo";

const dialogOpened = defineModel<boolean>("dialogOpened");
const props = defineProps<{
  canOpenDialog: boolean; // ダイアログを開いても良いかどうか
}>();

const store = useStore();

// エディタのアップデート確認
if (!import.meta.env.VITE_LATEST_UPDATE_INFOS_URL) {
  throw new Error(
    "環境変数VITE_LATEST_UPDATE_INFOS_URLが設定されていません。.envに記載してください。",
  );
}

// アプリのバージョンとスキップしたバージョンのうち、新しい方を返す
const currentVersionGetter = async () => {
  const appVersion = getAppInfos().version;

  await store.actions.WAIT_VUEX_READY({ timeout: 15000 });
  const skipUpdateVersion = store.state.skipUpdateVersion ?? "0.0.0";
  if (semver.valid(skipUpdateVersion) == undefined) {
    throw new Error(`skipUpdateVersionが不正です: ${skipUpdateVersion}`);
  }

  return semver.gt(appVersion, skipUpdateVersion)
    ? appVersion
    : skipUpdateVersion;
};

// 新しいバージョンがあれば取得
const newUpdateResult = useFetchNewUpdateInfos(currentVersionGetter, () =>
  UrlString(import.meta.env.VITE_LATEST_UPDATE_INFOS_URL),
);

// 新しいバージョンのアップデートがスキップされたときの処理
const handleSkipThisVersionClick = (version: string) => {
  void store.actions.SET_ROOT_MISC_SETTING({
    key: "skipUpdateVersion",
    value: version,
  });
};

// アップデートが選ばれたときの処理
const handleUpdateClick = () => {
  window.open(import.meta.env.VITE_OFFICIAL_WEBSITE_URL, "_blank");
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
