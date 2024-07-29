<!-- 
  アップデート通知ダイアログのコンテナ。
  スキップしたバージョンより新しいバージョンがあれば、ダイアログを表示する。
-->

<template>
  <UpdateNotificationDialog
    v-if="newUpdateResult.status == 'updateAvailable'"
    v-model="isDialogOpenComputed"
    :latestVersion="newUpdateResult.latestVersion"
    :newUpdateInfos="newUpdateResult.newUpdateInfos"
    @skipThisVersionClick="handleSkipThisVersionClick"
  />
</template>

<script setup lang="ts">
import semver from "semver";
import { computed, watch } from "vue";
import UpdateNotificationDialog from "./Presentation.vue";
import { useFetchNewUpdateInfos } from "@/composables/useFetchNewUpdateInfos";
import { useStore } from "@/store";
import { UrlString } from "@/type/preload";

const props = defineProps<{
  canOpenDialog: boolean; // ダイアログを開いても良いかどうか
}>();

const store = useStore();

const isDialogOpenComputed = computed({
  get: () => store.state.isUpdateNotificationDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isUpdateNotificationDialogOpen: val,
    }),
});

// エディタのアップデート確認
if (!import.meta.env.VITE_LATEST_UPDATE_INFOS_URL) {
  throw new Error(
    "環境変数VITE_LATEST_UPDATE_INFOS_URLが設定されていません。.envに記載してください。",
  );
}

// アプリのバージョンとスキップしたバージョンのうち、新しい方を返す
const currentVersionGetter = async () => {
  const appVersion = await window.backend
    .getAppInfos()
    .then((obj) => obj.version);

  await store.dispatch("WAIT_VUEX_READY", { timeout: 15000 });
  const skipUpdateVersion = store.state.skipUpdateVersion ?? "0.0.0";
  if (semver.valid(skipUpdateVersion) == undefined) {
    throw new Error(`skipUpdateVersionが不正です: ${skipUpdateVersion}`);
  }

  return semver.gt(appVersion, skipUpdateVersion)
    ? appVersion
    : skipUpdateVersion;
};

// 新しいバージョンがあれば取得
const newUpdateResult = useFetchNewUpdateInfos(
  currentVersionGetter,
  UrlString(import.meta.env.VITE_LATEST_UPDATE_INFOS_URL),
);

// 新しいバージョンのアップデートがスキップされたときの処理
const handleSkipThisVersionClick = (version: string) => {
  store.dispatch("SET_ROOT_MISC_SETTING", {
    key: "skipUpdateVersion",
    value: version,
  });
};

// ダイアログを開くかどうか
watch(
  () => [props.canOpenDialog, newUpdateResult],
  () => {
    if (
      props.canOpenDialog &&
      newUpdateResult.value.status == "updateAvailable"
    ) {
      isDialogOpenComputed.value = true;
    }
  },
);
</script>
